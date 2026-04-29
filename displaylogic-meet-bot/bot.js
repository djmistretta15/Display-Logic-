require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CLI_MEET_URL = process.argv[2];
const MEET_URL = CLI_MEET_URL || process.env.MEET_URL;
const BOT_NAME = process.env.BOT_NAME || 'DisplayLogic';
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
const RECORDING_PATH = path.join(RECORDINGS_DIR, 'meeting-audio.webm');

if (!MEET_URL || MEET_URL === 'paste_google_meet_link_here') {
  console.error('Set MEET_URL in .env or pass URL via CLI: node bot.js <meet_url>');
  process.exit(1);
}

async function clickIfVisible(page, selectors) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 1500 });
        return true;
      } catch {}
    }
  }
  return false;
}

async function setNameIfPrompted(page) {
  const nameInput = page
    .locator('input[aria-label*="name" i], input[placeholder*="name" i], input[type="text"]')
    .first();

  if (await nameInput.count()) {
    try {
      await nameInput.fill(BOT_NAME);
      console.log(`Entered bot name: ${BOT_NAME}`);
    } catch {}
  }
}

async function muteDevices(page) {
  await clickIfVisible(page, [
    'button[aria-label*="Turn off microphone" i]',
    'button[aria-label*="microphone" i]',
  ]);
  await clickIfVisible(page, [
    'button[aria-label*="Turn off camera" i]',
    'button[aria-label*="camera" i]',
  ]);
}

async function joinMeet(page) {
  await clickIfVisible(page, [
    'button:has-text("Join now")',
    'button:has-text("Ask to join")',
    'div[role="button"]:has-text("Join now")',
    'div[role="button"]:has-text("Ask to join")',
  ]);
}

async function startAudioRecording(page) {
  if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: RECORDINGS_DIR,
  });

  await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      throw new Error('No audio track was captured.');
    }

    const audioOnlyStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioOnlyStream, { mimeType: 'audio/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    window.__displayLogicStopRecording = () =>
      new Promise((resolve) => {
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'meeting-audio.webm';
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        };
        recorder.stop();
      });

    recorder.start(1000);
  });

  console.log(`Recording started. Output target: ${RECORDING_PATH}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Google Meet',
      '--allow-http-screen-capture',
    ],
  });

  const context = await browser.newContext({
    permissions: ['camera', 'microphone', 'notifications'],
  });
  const page = await context.newPage();

  console.log(`Opening: ${MEET_URL} (source: ${CLI_MEET_URL ? 'cli' : '.env'})`);
  await page.goto(MEET_URL, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(4000);
  await setNameIfPrompted(page);
  await muteDevices(page);
  await joinMeet(page);

  console.log('Join flow attempted. Keeping session alive.');
  console.log('Starting audio recording (best effort)...');

  try {
    await startAudioRecording(page);
  } catch (err) {
    console.warn('Audio recording could not be started automatically:', err.message);
  }

  await new Promise(() => {});
})();
