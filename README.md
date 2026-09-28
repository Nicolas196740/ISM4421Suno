# SongForge — AI Music Generator

A one-page app that generates songs with the [Suno API](https://docs.sunoapi.org). Built for Netlify.

## Features
- **Simple mode**: describe a song, and the AI writes the lyrics and the music.
- **Custom mode**: title, style tags, your own lyrics, a "Write with AI" lyrics helper, excluded styles, vocal gender, length, style adherence and weirdness.
- Instrumental toggle and model picker (V6, V6 Wild, V6 Mini).
- Live status polling, playback that can start before the song is finished, MP3 and cover downloads, and a lyrics view.
- Song history saved in your browser, plus your credit balance in the header.

## How it works
- `index.html`: the whole front end (no build step).
- `netlify/functions/suno.mjs`: serverless proxy at `/api/*`. It holds the API key so the key never reaches the browser.

## Deploy to Netlify
1. In Netlify, go to **Add new site → Import an existing project**, pick this repo and branch `main`. Leave the build command empty and set the publish directory to `.`.
2. Under **Site configuration → Environment variables**, add `SUNO_API_KEY` with your key from sunoapi.org.
3. (Recommended) Add `APP_PASSWORD` so only people with the password can spend your credits.
4. Redeploy (**Deploys → Trigger deploy**) so the variables take effect.

## Run locally
```bash
npm i -g netlify-cli
cp .env.example .env   # fill in SUNO_API_KEY
netlify dev
```
