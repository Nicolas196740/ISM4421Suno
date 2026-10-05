// Pass-through proxy for the Suno API (https://docs.sunoapi.org).
// Callers must be signed in (Supabase email login): the Authorization header carries
// the user's Supabase access token, which is checked before anything reaches Suno.
// Each user supplies their own Suno API key in the x-suno-key header; it is forwarded
// to Suno for that request only and is never stored or logged. Routes:
//   POST /api/generate        -> /api/v1/generate
//   GET  /api/status?taskId=  -> /api/v1/generate/record-info
//   POST /api/lyrics          -> /api/v1/lyrics
//   GET  /api/lyrics-status?taskId= -> /api/v1/lyrics/record-info
//   GET  /api/credits         -> /api/v1/generate/credit
//   POST /api/callback        -> no-op receiver (Suno requires a callBackUrl; the app polls instead)

const BASE = "https://api.sunoapi.org/api/v1";
// Supabase project "ISM 4421". Both values are public (same as in index.html);
// env vars override them if you ever point the app at another project.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ztksfrnobaefsrtnziqv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MfqkM90fPNLh4gsttD78tQ_X5wFiSfo";
const MODELS = ["V6", "V6_WILD", "V6_MINI"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function suno(path, key, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    return json({ code: res.status, msg: `Suno API returned HTTP ${res.status}` }, 502);
  }
  return json(data, res.ok ? 200 : res.status);
}

// Verified tokens are cached briefly so status polling doesn't hit Supabase every 5 seconds.
const verified = new Map(); // access token -> cache expiry (ms)

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function isSignedIn(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return false;
  const token = m[1].trim();
  const now = Date.now();
  const cached = verified.get(token);
  if (cached && cached > now) return true;

  const exp = tokenExpiry(token);
  if (exp && exp <= now) return false;
  // Supabase Auth confirms the token is genuine, unexpired and the user still exists.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;

  if (verified.size > 1000) verified.clear();
  verified.set(token, Math.min(now + 60_000, exp || now + 60_000));
  return true;
}

const clampStr = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function buildGeneratePayload(b, callBackUrl) {
  const model = MODELS.includes(b.model) ? b.model : "V6";
  const instrumental = !!b.instrumental;
  const p = { model, instrumental, callBackUrl };

  if (b.customMode) {
    p.customMode = true;
    const style = clampStr(b.style, 1000);
    const lyrics = instrumental ? "" : clampStr(b.lyrics, 5000);
    const title = clampStr(b.title, 80);
    const negativeTags = clampStr(b.negativeTags, 1000);
    if (style) p.style = style;
    if (lyrics) p.lyrics = lyrics;
    if (title) p.title = title;
    if (negativeTags) p.negativeTags = negativeTags;
    if (!style && !lyrics && !negativeTags) throw new Error("Custom mode needs a style or lyrics.");
    if (!instrumental && (b.vocalGender === "m" || b.vocalGender === "f")) p.vocalGender = b.vocalGender;
    const dur = Number(b.duration);
    if (Number.isFinite(dur) && dur >= 10 && dur <= 360) p.duration = Math.round(dur);
    for (const k of ["styleWeight", "weirdnessConstraint"]) {
      const n = Number(b[k]);
      if (b[k] !== undefined && b[k] !== "" && Number.isFinite(n)) p[k] = Math.min(1, Math.max(0, Math.round(n * 100) / 100));
    }
  } else {
    p.customMode = false;
    const prompt = clampStr(b.prompt, 3000);
    const style = clampStr(b.style, 1000);
    if (prompt) p.prompt = prompt;
    if (style) p.style = style;
    if (!prompt && !style) throw new Error("Describe the song you want.");
  }
  return p;
}

export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");

  // Suno posts results here; we poll instead, so just acknowledge.
  if (route === "callback") return json({ status: "received" });

  try {
    if (!(await isSignedIn(req))) {
      return json({ code: 401, reason: "session", msg: "Please sign in to continue." }, 401);
    }
  } catch {
    return json({ code: 503, msg: "Couldn't reach the login service. Try again in a moment." }, 503);
  }

  const key = (req.headers.get("x-suno-key") || "").trim();
  if (!key) return json({ code: 401, reason: "key", msg: "Add your Suno API key to continue." }, 401);

  const siteUrl = process.env.URL || url.origin;
  const callBackUrl = `${siteUrl}/api/callback`;

  try {
    if (route === "credits" && req.method === "GET") {
      return suno("/generate/credit", key);
    }

    if (route === "status" && req.method === "GET") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return json({ code: 400, msg: "taskId is required" }, 400);
      return suno(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`, key);
    }

    if (route === "lyrics-status" && req.method === "GET") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return json({ code: 400, msg: "taskId is required" }, 400);
      return suno(`/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`, key);
    }

    if (route === "generate" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      let payload;
      try {
        payload = buildGeneratePayload(body, callBackUrl);
      } catch (e) {
        return json({ code: 400, msg: e.message }, 400);
      }
      return suno("/generate", key, { method: "POST", body: JSON.stringify(payload) });
    }

    if (route === "lyrics" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const prompt = clampStr(body.prompt, 200);
      if (!prompt) return json({ code: 400, msg: "Give the lyrics a topic." }, 400);
      return suno("/lyrics", key, { method: "POST", body: JSON.stringify({ prompt, callBackUrl }) });
    }

    return json({ code: 404, msg: `Unknown route: ${route}` }, 404);
  } catch (e) {
    return json({ code: 500, msg: e.message || "Server error" }, 500);
  }
};

export const config = { path: "/api/*" };
