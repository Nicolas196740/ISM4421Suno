# SongForge — AI Music Generator

A one-page app that generates songs with the [Suno API](https://docs.sunoapi.org). Built for Netlify.

## Features
- **Simple mode**: describe a song, and the AI writes the lyrics and the music.
- **Custom mode**: title, style tags, your own lyrics, a "Write with AI" lyrics helper, excluded styles, vocal gender, length, style adherence and weirdness.
- Instrumental toggle and model picker (V6, V6 Wild, V6 Mini).
- Live status polling, playback that can start before the song is finished, MP3 and cover downloads, and a lyrics view.
- Song history saved in your browser, plus your credit balance in the header.
- **Bring your own API key**: each user pastes their own sunoapi.org key when they open the app.

## How it works
- `index.html`: the whole front end (no build step).
- `netlify/functions/suno.mjs`: serverless pass-through at `/api/*`. It forwards the user's key to Suno with each request and never stores or logs it.

## API keys
No key is stored in the code or in Netlify. When someone opens the app, it asks for their Suno API key (get one at https://sunoapi.org/api-key).
- By default the key is kept only for that browser tab and is cleared when the tab closes.
- Ticking **Remember on this device** keeps it in that browser until they click **Forget key**.

## Deploy to Netlify
1. In Netlify, go to **Add new site → Import an existing project**, pick this repo and branch `main`. Leave the build command empty and set the publish directory to `.`.
2. Click **Deploy**. No environment variables are needed.

## Run locally
```bash
npm i -g netlify-cli
netlify dev
```
