// Zero-dependency static build. Wraps each page in src/pages with the shared layout,
// expands lead forms, fills {{tokens}} from site.config.mjs, and writes dist/.
// Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import cfg from "./site.config.mjs";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

// Short content hash appended to CSS/JS URLs so browsers pick up changes right away.
const ver = (f) => createHash("sha1").update(readFileSync(join(SRC, "assets", f))).digest("hex").slice(0, 8);
const V = { css: ver("styles.css"), js: ver("site.js") };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NAV = [
  ["/", "Home"],
  ["/projects", "Projects"],
  ["/investors", "Investors"],
  ["/sell-your-land", "Sell Your Land"],
  ["/about", "About"],
];

// ---------- Lead forms ----------
const opt = (list) => list.map((v) => (Array.isArray(v) ? `<option value="${esc(v[0])}">${esc(v[1])}</option>` : `<option>${esc(v)}</option>`)).join("");
const select = (name, label, list, { required = false, hint = "" } = {}) => `
      <div class="field">
        <label for="f-${name}-ID">${label}${required ? "" : ' <span class="opt">(optional)</span>'}</label>
        <select id="f-${name}-ID" name="${name}"${required ? " required" : ""}>
          <option value="">Select…</option>${opt(list)}
        </select>${hint ? `<small>${hint}</small>` : ""}
      </div>`;
const input = (name, label, { type = "text", required = false, auto = "", placeholder = "", max = 120 } = {}) => `
      <div class="field">
        <label for="f-${name}-ID">${label}${required ? "" : ' <span class="opt">(optional)</span>'}</label>
        <input id="f-${name}-ID" name="${name}" type="${type}" maxlength="${max}"${auto ? ` autocomplete="${auto}"` : ""}${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${required ? " required" : ""} />
      </div>`;
const radios = (name, label, list, { required = false } = {}) => `
      <fieldset class="field radios">
        <legend>${label}${required ? "" : ' <span class="opt">(optional)</span>'}</legend>
        <div class="radio-row">${list
          .map(([v, l], i) => `<label class="pill"><input type="radio" name="${name}" value="${v}"${required && i === 0 ? " required" : ""} /> <span>${l}</span></label>`)
          .join("")}</div>
      </fieldset>`;

const AREAS = ["Miami-Dade", "Broward", "Palm Beach", "Open to any"];

const EXTRA = {
  buyer: `
    <div class="extra" data-for="buyer">
      <h3 class="extra-title">About your home search</h3>
      <div class="grid-2">${select("budget_range", "Budget range", ["Under $400K", "$400K – $550K", "$550K – $700K", "$700K – $900K", "$900K+"], { required: true })}
      ${select("desired_area", "Desired area", AREAS, { required: true })}
      ${select("timeline", "When do you want to move?", ["0–3 months", "3–6 months", "6–12 months", "12+ months", "Just exploring"], { required: true })}
      ${radios("pre_approved", "Pre-approved for financing?", [["yes", "Yes"], ["no", "No"]], { required: true })}</div>
    </div>`,
  investor: `
    <div class="extra" data-for="investor">
      <h3 class="extra-title">About your investment goals</h3>
      <div class="grid-2">${select("investment_range", "Investment range", ["Under $250K", "$250K – $500K", "$500K – $1M", "$1M – $3M", "$3M+"], { required: true })}
      ${select("investor_interest", "I'm interested in", [["buy_completed", "Buying a completed property"], ["invest_in_project", "Investing capital in a project"], ["both", "Both"]], { required: true })}
      ${select("experience_level", "Real estate experience", ["First investment", "1–3 properties", "4–10 properties", "10+ properties / fund"], { required: true })}</div>
    </div>`,
  land_owner: `
    <div class="extra" data-for="land_owner">
      <h3 class="extra-title">About the property</h3>
      ${input("property_address", "Property address", { required: true, auto: "street-address", max: 250, placeholder: "Street, city, ZIP" })}
      <div class="grid-2">${input("lot_size", "Lot size", { required: true, placeholder: "e.g. 7,500 sq ft or 0.17 acres", max: 60 })}
      ${input("current_zoning", "Current zoning, if known", { placeholder: "e.g. RD-15, RM-2, R-2", max: 60 })}
      ${input("asking_price", "Asking price", { placeholder: "e.g. $350,000 or open to offers", max: 60 })}
      ${radios("owner_or_agent", "I am the", [["owner", "Owner"], ["agent", "Agent / broker"]], { required: true })}</div>
    </div>`,
};

let formCount = 0;
function leadForm(type, { heading = "", submit = "Send" } = {}) {
  const id = `lf${++formCount}`;
  const fixed = type !== "any";
  const typeField = fixed
    ? `<input type="hidden" name="lead_type" value="${type}" />`
    : select("lead_type", "I am a…", [["buyer", "Home buyer"], ["investor", "Real estate investor"], ["land_owner", "Land owner"], ["other", "Other"]], { required: true });
  const extras = fixed ? EXTRA[type] || "" : Object.values(EXTRA).join("");
  const html = `
  <form class="lead-form card" data-lead-form novalidate>
    ${heading ? `<h2 class="form-title">${heading}</h2>` : ""}
    <div class="form-body">
      ${typeField}
      <div class="grid-2">${input("full_name", "Full name", { required: true, auto: "name" })}
      ${input("email", "Email", { type: "email", required: true, auto: "email", max: 254 })}
      ${input("phone", "Phone", { type: "tel", required: true, auto: "tel", max: 30 })}
      ${select("preferred_contact", "Preferred contact method", [["phone", "Phone call"], ["text", "Text message"], ["email", "Email"]], { required: true })}</div>
      ${extras}
      <div class="field">
        <label for="f-message-ID">Message <span class="opt">(optional)</span></label>
        <textarea id="f-message-ID" name="message" rows="4" maxlength="3000" placeholder="Anything we should know?"></textarea>
      </div>
      ${select("heard_about", "How did you hear about us?", ["Google search", "Instagram", "Facebook", "Referral / word of mouth", "Real estate agent", "Sign at a project site", "Other"])}
      <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
      <label class="check"><input type="checkbox" name="consent_contact" required /> <span>I agree to be contacted by KLAR Construction about my inquiry. <span class="req">*</span></span></label>
      <label class="check"><input type="checkbox" name="consent_sms" /> <span>Optional: I agree to receive text messages from KLAR Construction about my inquiry. Message and data rates may apply. Reply STOP to opt out.</span></label>
      <p class="fine">See our <a href="/privacy">Privacy Policy</a> for how we use your information. We never sell it.</p>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${submit}</button>
    </div>
    <div class="thanks" hidden tabindex="-1">
      <div class="thanks-icon" aria-hidden="true">✓</div>
      <h2>Thank you. We got your message.</h2>
      <p>A member of the KLAR team will reach out within one business day. Need us sooner? Call <a href="tel:{{phoneHref}}">{{phone}}</a>.</p>
    </div>
  </form>`;
  return html.replace(/-ID"/g, `-${id}"`);
}

// ---------- Layout ----------
function layout({ title, description, path, body, noindex = false, schema = "" }) {
  const url = cfg.siteUrl + (path === "/" ? "/" : path);
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
${noindex ? '<meta name="robots" content="noindex, nofollow" />' : `<link rel="canonical" href="${url}" />`}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(cfg.name)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${cfg.siteUrl}/assets/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#0f2a3d" />
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/styles.css?v=${V.css}" />
${schema}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="/" aria-label="KLAR Construction home">
      <img src="/assets/logo.svg" alt="KLAR Construction" width="148" height="36" />
    </a>
    <nav class="nav" id="site-nav" aria-label="Main">${nav}<a class="btn btn-primary nav-cta" href="/contact">Get in touch</a></nav>
    <button class="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <img src="/assets/logo-light.svg" alt="KLAR Construction" width="148" height="36" />
      <p>New construction duplexes, triplexes and townhomes across South Florida.</p>
      <p class="muted">Serving ${cfg.serviceArea.join(", ")} counties.</p>
    </div>
    <div>
      <h3>Explore</h3>
      <ul>${NAV.slice(1).map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}<li><a href="/contact">Contact</a></li></ul>
    </div>
    <div>
      <h3>Contact</h3>
      <ul>
        <li><a href="tel:{{phoneHref}}">{{phone}}</a></li>
        <li><a href="mailto:{{email}}">{{email}}</a></li>
        <li class="muted">${cfg.hours[0][0]}: ${cfg.hours[0][1]}</li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <span>© <span data-year>2026</span> KLAR Construction. All rights reserved.</span>
    <a href="/privacy">Privacy Policy</a>
  </div>
</footer>
<script src="/assets/site.js?v=${V.js}" defer></script>
</body>
</html>
`;
}

// ---------- Structured data (local SEO) ----------
const orgSchema = `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: cfg.name,
  url: cfg.siteUrl + "/",
  logo: cfg.siteUrl + "/assets/logo.svg",
  telephone: cfg.phone,
  email: cfg.email,
  description: "Residential real estate developer building new construction duplexes, triplexes, townhomes and small multifamily projects in South Florida.",
  areaServed: cfg.serviceArea.map((c) => ({ "@type": "AdministrativeArea", name: `${c} County, Florida` })),
  address: { "@type": "PostalAddress", addressRegion: "FL", addressCountry: "US" },
  openingHours: ["Mo-Fr 09:00-18:00", "Sa 10:00-14:00"],
})}</script>`;

const faqSchema = (pairs) =>
  `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  })}</script>`;

// ---------- Build ----------
function parsePage(src) {
  const m = /^<!--meta\n([\s\S]*?)\n-->\n?/.exec(src);
  if (!m) throw new Error("Page is missing its <!--meta ... --> header");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

function fill(html) {
  const tokens = { ...cfg, year: new Date().getFullYear() };
  return html.replace(/\{\{cssVer\}\}/g, V.css).replace(/\{\{(\w+)\}\}/g, (all, k) => (k in tokens && typeof tokens[k] !== "object" ? esc(tokens[k]) : all));
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(SRC, "assets"), join(DIST, "assets"), { recursive: true });

const pages = [];
for (const file of readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"))) {
  const { meta, body } = parsePage(readFileSync(join(SRC, "pages", file), "utf8"));
  let expanded = body.replace(/<!--#form (\w+)(?: heading="([^"]*)")?(?: submit="([^"]*)")?-->/g, (_, type, heading, submit) =>
    leadForm(type, { heading, submit }),
  );
  expanded = expanded.replace(/<!--#hours-->/g, () =>
    `<dl class="hours">${cfg.hours.map(([d, h]) => `<div><dt>${esc(d)}</dt><dd>${esc(h)}</dd></div>`).join("")}</dl>`,
  );
  let schema = meta.path === "/" || meta.path === "/contact" || meta.path === "/about" ? orgSchema : "";
  if (meta.faq) {
    const pairs = JSON.parse(readFileSync(join(SRC, "pages", meta.faq), "utf8"));
    schema += faqSchema(pairs);
    expanded = expanded.replace(
      "<!--#faq-->",
      `<div class="faq">${pairs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`,
    );
  }
  const noindex = meta.noindex === "true";
  const out = meta.raw === "true" ? expanded : layout({ ...meta, body: expanded, noindex, schema });
  writeFileSync(join(DIST, file), fill(out));
  if (!noindex) pages.push(meta.path);
}

writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .sort()
    .map((p) => `  <url><loc>${cfg.siteUrl}${p === "/" ? "/" : p}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nDisallow: /admin\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
console.log(`Built ${readdirSync(DIST).filter((f) => f.endsWith(".html")).length} pages to dist/ (${pages.length} in sitemap).`);
