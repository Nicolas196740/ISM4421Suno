// Edit these once and rebuild (`node build.mjs`). Every page pulls from here.
export default {
  name: "KLAR Construction",
  // TODO: your live domain, no trailing slash. Used for canonical URLs, the sitemap and social previews.
  siteUrl: "https://www.example.com",
  phone: "xxx-xxx-xxxx",
  phoneHref: "+1xxxxxxxxxx",
  email: "[email]",
  hours: [
    ["Monday – Friday", "9:00 AM – 6:00 PM"],
    ["Saturday", "10:00 AM – 2:00 PM"],
    ["Sunday", "Closed"],
  ],
  serviceArea: ["Miami-Dade", "Broward", "Palm Beach"],
  // Supabase project "KLAR Construction". The publishable key is public by design;
  // Row Level Security only lets visitors insert leads, never read them.
  supabaseUrl: "https://bgldeluwjsabjyfczfwi.supabase.co",
  supabaseKey: "sb_publishable_1gQARpa0kCSg1XmnV4jeYw_ToWoR3So",
};
