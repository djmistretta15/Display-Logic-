# Display Logic — System Builder 2.0

AI-guided display configuration tool for Display Logic USA.

## Stack
- React 18 + Vite
- Anthropic Claude API (claude-sonnet-4-20250514)
- Pure inline styles — no CSS framework required

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

```bash
npm run build
# Push the /dist folder to your gh-pages branch
```

## API Note
The AI Advisor calls the Anthropic API directly from the browser.
For production, proxy this through a backend to protect your API key.
Set up a `/api/chat` endpoint and update the fetch URL in `DisplayBuilder.jsx` line ~207.

## File Structure
```
src/
  App.jsx           → root, renders DisplayBuilder
  DisplayBuilder.jsx → full application component
  index.css         → minimal reset only
```
