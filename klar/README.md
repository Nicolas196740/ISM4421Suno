# KLAR Construction website

Lead-generation site for KLAR Construction: new construction duplexes, triplexes, townhomes and small multifamily projects in South Florida.

## What's here
| Page | URL | Lead form |
|---|---|---|
| Home | `/` | Three audience paths + "Get in touch" |
| Projects | `/projects` | Buyer list form |
| Investors | `/investors` | Investor interest form |
| Sell Your Land | `/sell-your-land` | Land submission form |
| About | `/about` | — |
| Contact | `/contact` | General form (visitor picks buyer / investor / land owner / other; extra fields appear to match) |
| Privacy Policy | `/privacy` | — |
| Admin dashboard | `/admin` | Login protected, hidden from search engines |

Every form saves to the Supabase table **`leads`** and emails you a notification.

## How it works
- `src/pages/*.html`: page content. `src/assets/`: CSS, JS, logo and images.
- `build.mjs`: wraps each page in the shared header/footer, builds the forms, adds SEO tags, and writes `dist/` plus `sitemap.xml` and `robots.txt`. No dependencies. Run `node build.mjs`.
- `site.config.mjs`: **phone, email, hours, domain and service area. Edit here once and every page updates.**
- `netlify/functions/lead.mjs`: `/api/lead`. Validates the form, blocks spam (hidden honeypot field, too-fast submits, 5 per IP per 10 min), saves the lead, and emails you through Resend.
- `supabase/migrations/20261014000001_leads.sql`: database schema (already applied to Supabase project **KLAR Construction**).

## Database security
- Visitors can only **add** a lead. They can't read, edit or delete any, and can't set status or notes.
- Only accounts listed in `public.admins` can read leads and change status and notes.
- The consent checkbox is enforced by the database too: a lead without consent is rejected.

## Setup (one time)

### 1. Create your admin login
1. Supabase → project **KLAR Construction** → **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. **SQL Editor**, run (with your email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Only you need an account.

### 2. Set up email alerts (Resend, free up to 3,000 emails/month)
1. Sign up at https://resend.com with the email address you want alerts sent to.
2. **API Keys → Create API key** (Sending access). Copy it.
3. Until you verify a domain, Resend only delivers to your own Resend account email, which is fine for alerts. Once you own your domain, verify it in Resend and set `NOTIFY_FROM` (below) so alerts come from it.

### 3. Deploy to Netlify
1. Netlify → **Add new site → Import an existing project** → this repo.
2. **Base directory: `klar`**. Build command and publish directory come from `klar/netlify.toml` (`node build.mjs` → `dist`).
3. **Site configuration → Environment variables**:
   | Variable | Value |
   |---|---|
   | `RESEND_API_KEY` | your Resend key |
   | `NOTIFY_EMAIL` | where alerts go (comma-separate for several) |
   | `NOTIFY_FROM` | optional, e.g. `KLAR Leads <leads@yourdomain.com>` once your domain is verified |
4. Deploy, then submit a test lead and check your inbox and `/admin`.
5. Supabase → **Authentication → URL Configuration**: set **Site URL** to your live URL and add `https://yourdomain.com/**` to **Redirect URLs** (needed for "Forgot password").

If email isn't set up, leads are still saved; you just won't get the alert. Check **Netlify → Logs → Functions** for "Lead email failed" if alerts stop.

## Before launch: replace the placeholders
- `site.config.mjs`: `siteUrl`, `phone`, `phoneHref`, `email`, hours.
- **Brand colors**: top of `src/assets/styles.css` (`--brand`, `--accent`, etc.). `theme-color` in `build.mjs`.
- **Logo**: replace `src/assets/logo.svg` (dark text, for the header) and `logo-light.svg` (white text, for the footer and admin). PNG works too; update the file names in `build.mjs`.
- **Projects**: edit the cards in `src/pages/projects.html`. Put photos in `src/assets/` and change each `<img src>`. Keep `data-status` as `presale`, `construction`, `soon` or `done` so the filters work.
- **Copy**: claims like "reply within one business day," "impact windows," "concrete block" and the stats on the home page are placeholders. Keep only what's true.
- **Privacy policy**: written for this site's actual data use, but have a Florida attorney review it, especially the SMS section, before you start texting leads.
- **Investors page**: has a securities disclaimer. Raising capital from investors is regulated (SEC/Florida OFR). Talk to a securities attorney before taking investor money.

## SEO
- Each page has a keyword-targeted title, meta description, canonical URL and social preview image.
  - Home → "new construction duplex South Florida"
  - Sell Your Land → "sell my land South Florida"
  - Investors → "multifamily investment property Florida"
- Structured data: `HomeAndConstructionBusiness` (service area: the three counties) and FAQ markup on Investors and Sell Your Land.
- `sitemap.xml` and `robots.txt` are generated; `/admin` is blocked from indexing.
- After launch: add the site to **Google Search Console**, submit `https://yourdomain.com/sitemap.xml`, and create a **Google Business Profile**. For local searches, those two matter more than anything on the page.

## Run locally
```bash
cd klar
npm i -g netlify-cli
netlify dev        # site + /api/lead at http://localhost:8888
```
