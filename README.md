# SongForge — AI Music Generator

A one-page app that generates songs with the [Suno API](https://docs.sunoapi.org). Built for Netlify.

## Features
- **Simple mode**: describe a song, and the AI writes the lyrics and the music.
- **Custom mode**: title, style tags, your own lyrics, a "Write with AI" lyrics helper, excluded styles, vocal gender, length, style adherence and weirdness.
- Instrumental toggle and model picker (V6, V6 Wild, V6 Mini).
- Live status polling, playback that can start before the song is finished, MP3 and cover downloads, and a lyrics view.
- Song history saved in your browser, plus your credit balance in the header.
- **Email login** (Supabase): sign up, confirm your email, sign in, sign out, reset a forgotten password.
- **User profiles**: display name, unique @username, bio, favorite genres and a profile photo. New users set one up right after their first sign-in; edit it any time from the header.
- **Bring your own API key**: each user pastes their own sunoapi.org key after signing in.

## How it works
- `index.html`: the whole front end (no build step).
- `netlify/functions/suno.mjs`: serverless pass-through at `/api/*`. It checks that the caller is signed in (Supabase access token), then forwards the user's Suno key to Suno. It never stores or logs the key.
- Supabase project **ISM 4421** handles accounts. Its URL and publishable key are in both files; they're public by design.

## Login
- Email + password through Supabase Auth. New users confirm their email once.
- Song history is kept per account in the browser.
- Signing out also clears the Suno key from that browser.
- Supabase's built-in email sender only allows a few emails per hour. That's fine for testing. For more sign-ups, add your own SMTP provider under **Authentication → Emails → SMTP Settings**.

## Profiles (database)
Schema lives in `supabase/migrations/20261005000001_profiles.sql` (already applied to project **ISM 4421**).
- `public.profiles`: one row per user, created automatically at sign-up by a trigger.
- Row Level Security: each user can only read and edit their own profile. Signed-out visitors can't read any.
- Usernames are unique, 3–20 lowercase letters, numbers or underscores (enforced by the database).
- Photos go in the public `avatars` storage bucket (2 MB max, images only). Users can only upload to or delete from their own folder. The app crops photos to 256×256 before upload and deletes the old photo when it's replaced.

## API keys
No key is stored in the code or in Netlify. When someone opens the app, it asks for their Suno API key (get one at https://sunoapi.org/api-key).
- By default the key is kept only for that browser tab and is cleared when the tab closes.
- Ticking **Remember on this device** keeps it in that browser until they click **Forget key**.

## Deploy to Netlify
1. In Netlify, go to **Add new site → Import an existing project**, pick this repo and branch `main`. Leave the build command empty and set the publish directory to `.`.
2. Click **Deploy**. No environment variables are needed.
3. In Supabase (project **ISM 4421**) go to **Authentication → URL Configuration**:
   - **Site URL**: your Netlify URL, e.g. `https://your-site.netlify.app`
   - **Redirect URLs**: add `https://your-site.netlify.app/**`

   Without this, the links in confirmation and password-reset emails point to `localhost:3000`.

## Run locally
```bash
npm i -g netlify-cli
netlify dev
```
