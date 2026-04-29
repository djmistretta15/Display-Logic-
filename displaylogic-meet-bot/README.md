# DisplayLogic Meet Bot (MVP)

## Scope
This MVP only handles: **n8n -> local server -> Google Meet bot launch**.

No transcription, summarization, dashboards, billing, Zoom, SaaS, or user accounts.

## Install
```bash
npm install express cors dotenv playwright
npx playwright install chromium
```

## Environment
Create `.env` from `.env.example`.

```env
BOT_NAME="DisplayLogic"
PORT=8787
MEET_URL=""
```

## Run
Start local API server:
```bash
npm start
```

Directly run bot with a URL:
```bash
npm run join -- "https://meet.google.com/abc-defg-hij"
```

## Test /join-meet with curl
```bash
curl -X POST http://localhost:8787/join-meet \
  -H "Content-Type: application/json" \
  -d '{"meetUrl":"https://meet.google.com/abc-defg-hij","title":"Test Meeting"}'
```

Expected: JSON response with `ok: true` and Chromium opens for join flow.

## n8n plan
Workflow: **DisplayLogic - Auto Join Google Meet**

1. Google Calendar Trigger (created/updated event, primary calendar).
2. Code node to extract Meet URL from `hangoutLink` / `conferenceData` / description / location.
3. IF node: continue only if Meet URL exists.
4. IF node: continue only if start time is within next 10 minutes.
5. HTTP Request node:
   - POST `http://localhost:8787/join-meet`
   - JSON body: `meetUrl`, `title`, `startTime`

## Docker localhost warning
If n8n runs in Docker, `localhost` refers to the container.
Use `http://host.docker.internal:8787/join-meet` or same Docker network.
