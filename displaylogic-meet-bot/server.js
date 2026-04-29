require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8787);
const DEDUPE_FILE = path.join(__dirname, 'processedMeetUrls.json');
const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

const app = express();
app.use(cors());
app.use(express.json());

function loadDedupe() {
  try {
    if (!fs.existsSync(DEDUPE_FILE)) return {};
    return JSON.parse(fs.readFileSync(DEDUPE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveDedupe(data) {
  fs.writeFileSync(DEDUPE_FILE, JSON.stringify(data, null, 2));
}

function pruneOld(data, now) {
  Object.keys(data).forEach((url) => {
    if (now - data[url] > DEDUPE_WINDOW_MS) delete data[url];
  });
}

function isValidMeetUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.hostname === 'meet.google.com';
  } catch {
    return false;
  }
}

app.post('/join-meet', (req, res) => {
  const { meetUrl, title, startTime } = req.body || {};

  if (!meetUrl) {
    return res.status(400).json({ ok: false, message: 'meetUrl is required' });
  }

  if (!isValidMeetUrl(meetUrl)) {
    return res.status(400).json({ ok: false, message: 'meetUrl must be a valid meet.google.com URL' });
  }

  const now = Date.now();
  const dedupe = loadDedupe();
  pruneOld(dedupe, now);

  if (dedupe[meetUrl] && now - dedupe[meetUrl] <= DEDUPE_WINDOW_MS) {
    return res.json({ ok: false, message: 'Meeting already launched recently', meetUrl });
  }

  const botPath = path.join(__dirname, 'bot.js');
  const child = spawn(process.execPath, [botPath, meetUrl], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  dedupe[meetUrl] = now;
  saveDedupe(dedupe);

  return res.json({
    ok: true,
    message: 'DisplayLogic bot launched',
    meetUrl,
    title: title || null,
    startTime: startTime || null,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'displaylogic-meet-bot', port: PORT });
});

app.listen(PORT, () => {
  console.log(`DisplayLogic server listening on http://localhost:${PORT}`);
});
