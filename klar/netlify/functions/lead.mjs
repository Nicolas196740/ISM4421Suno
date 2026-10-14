// POST /api/lead: validates a website inquiry, saves it to the Supabase "leads" table,
// then emails a notification through Resend (https://resend.com).
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   RESEND_API_KEY   required for email; without it leads are still saved, just not emailed
//   NOTIFY_EMAIL     where new-lead alerts go (comma-separate for several)
//   NOTIFY_FROM      optional sender, e.g. "KLAR Leads <leads@yourdomain.com>" (domain verified in Resend)
//   ADMIN_URL        optional link in the email, defaults to <site>/admin
//   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY  optional overrides for the values below

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bgldeluwjsabjyfczfwi.supabase.co";
// Public key: Row Level Security only allows this key to INSERT leads, never read them.
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1gQARpa0kCSg1XmnV4jeYw_ToWoR3So";

const TYPES = { buyer: "Home buyer", investor: "Investor", land_owner: "Land owner", other: "Other" };
const CONTACT = ["email", "phone", "text"];
const INTEREST = ["buy_completed", "invest_in_project", "both"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;
const oneOf = (v, list) => (list.includes(v) ? v : null);

// Best-effort burst limit per IP (resets when the function instance recycles).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

function buildLead(b) {
  const lead_type = oneOf(b.lead_type, Object.keys(TYPES));
  const lead = {
    lead_type,
    full_name: str(b.full_name, 120),
    email: str(b.email, 254)?.toLowerCase() ?? null,
    phone: str(b.phone, 30),
    preferred_contact: oneOf(b.preferred_contact, CONTACT),
    message: str(b.message, 3000),
    heard_about: str(b.heard_about, 120),
    consent_contact: b.consent_contact === true,
    consent_sms: b.consent_sms === true,
    source_page: str(b.source_page, 60),
  };
  const errors = [];
  if (!lead_type) errors.push("lead type");
  if (!lead.full_name || lead.full_name.length < 2) errors.push("full name");
  if (!lead.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) errors.push("a valid email");
  if (!lead.phone || lead.phone.replace(/\D/g, "").length < 10) errors.push("a valid phone number");
  if (!lead.preferred_contact) errors.push("preferred contact method");
  if (!lead.consent_contact) errors.push("consent to be contacted");

  if (lead_type === "buyer") {
    Object.assign(lead, {
      budget_range: str(b.budget_range, 60),
      desired_area: str(b.desired_area, 120),
      timeline: str(b.timeline, 60),
      pre_approved: b.pre_approved === "yes" ? true : b.pre_approved === "no" ? false : null,
    });
    if (!lead.budget_range) errors.push("budget range");
    if (!lead.desired_area) errors.push("desired area");
    if (!lead.timeline) errors.push("timeline");
    if (lead.pre_approved === null) errors.push("pre-approval");
  } else if (lead_type === "investor") {
    Object.assign(lead, {
      investment_range: str(b.investment_range, 60),
      investor_interest: oneOf(b.investor_interest, INTEREST),
      experience_level: str(b.experience_level, 60),
    });
    if (!lead.investment_range) errors.push("investment range");
    if (!lead.investor_interest) errors.push("investment interest");
    if (!lead.experience_level) errors.push("experience level");
  } else if (lead_type === "land_owner") {
    Object.assign(lead, {
      property_address: str(b.property_address, 250),
      lot_size: str(b.lot_size, 60),
      current_zoning: str(b.current_zoning, 60),
      asking_price: str(b.asking_price, 60),
      owner_or_agent: oneOf(b.owner_or_agent, ["owner", "agent"]),
    });
    if (!lead.property_address) errors.push("property address");
    if (!lead.lot_size) errors.push("lot size");
    if (!lead.owner_or_agent) errors.push("owner or agent");
  }
  return { lead, errors };
}

const LABELS = {
  full_name: "Name", email: "Email", phone: "Phone", preferred_contact: "Preferred contact",
  budget_range: "Budget", desired_area: "Desired area", timeline: "Timeline", pre_approved: "Pre-approved",
  investment_range: "Investment range", investor_interest: "Interest", experience_level: "Experience",
  property_address: "Property address", lot_size: "Lot size", current_zoning: "Zoning", asking_price: "Asking price",
  owner_or_agent: "Owner or agent", heard_about: "Heard about us", consent_sms: "OK to text", source_page: "Page", message: "Message",
};
const INTEREST_LABEL = { buy_completed: "Buy a completed property", invest_in_project: "Invest in a project", both: "Both" };
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function display(k, v) {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (k === "investor_interest") return INTEREST_LABEL[v] || v;
  if (k === "owner_or_agent") return v === "owner" ? "Owner" : "Agent / broker";
  return v;
}

async function notify(lead, adminUrl) {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) return "skipped";
  const rows = Object.entries(LABELS)
    .filter(([k]) => lead[k] !== null && lead[k] !== undefined && lead[k] !== "")
    .map(([k, label]) => [label, display(k, lead[k])]);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#0f2a3d;margin:0 0 4px">New ${escHtml(TYPES[lead.lead_type])} lead</h2>
<p style="color:#5d6b78;margin:0 0 16px">From the KLAR Construction website</p>
<table style="border-collapse:collapse;width:100%">${rows
    .map(([l, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#5d6b78;width:38%;vertical-align:top">${escHtml(l)}</td><td style="padding:8px;border-bottom:1px solid #eee;white-space:pre-wrap">${escHtml(v)}</td></tr>`)
    .join("")}</table>
<p style="margin-top:20px"><a href="${escHtml(adminUrl)}" style="background:#c9783b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Open lead dashboard</a></p>
</div>`;
  const text = rows.map(([l, v]) => `${l}: ${v}`).join("\n") + `\n\nDashboard: ${adminUrl}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || "KLAR Website <onboarding@resend.dev>",
      to,
      reply_to: lead.email,
      subject: `New ${TYPES[lead.lead_type]} lead: ${lead.full_name}`,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "sent";
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);

  // Spam traps: hidden honeypot field filled, or the form was submitted inhumanly fast.
  // Pretend success so bots don't learn anything.
  const started = Number(body.started_at) || 0;
  if (str(body.company_website, 200) || (started && Date.now() - started < 2500)) return json({ ok: true });

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many submissions. Please call or email us instead." }, 429);

  const { lead, errors } = buildLead(body);
  if (errors.length) return json({ error: `Please provide ${errors.join(", ")}.` }, 400);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(lead),
  }).catch(() => null);
  if (!res || !res.ok) {
    console.error("Lead insert failed", res?.status, res && (await res.text()).slice(0, 500));
    return json({ error: "We couldn't save your message just now. Please try again or call us." }, 502);
  }

  const site = process.env.URL || new URL(req.url).origin;
  try {
    await notify(lead, process.env.ADMIN_URL || `${site}/admin`);
  } catch (e) {
    // The lead is already saved; a failed email shouldn't fail the visitor's submission.
    console.error("Lead email failed:", e.message);
  }
  return json({ ok: true });
};

export const config = { path: "/api/lead" };
