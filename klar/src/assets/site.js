// KLAR Construction: mobile menu, project filters and lead forms.
(() => {
  // Mobile menu
  const btn = document.querySelector(".menu-btn");
  const nav = document.getElementById("site-nav");
  if (btn && nav) {
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // Project status filters
  const filters = document.querySelector("[data-filters]");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-filter]");
      if (!b) return;
      filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const f = b.dataset.filter;
      document.querySelectorAll("[data-status]").forEach((card) => {
        card.hidden = f !== "all" && card.dataset.status !== f;
      });
    });
  }

  // Lead forms
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function syncExtras(form) {
    const sel = form.querySelector('select[name="lead_type"]');
    const type = sel ? sel.value : form.querySelector('input[name="lead_type"]').value;
    form.querySelectorAll(".extra").forEach((box) => {
      const on = box.dataset.for === type;
      box.hidden = !on;
      // Disabled fields are skipped by validation and FormData.
      box.querySelectorAll("input, select, textarea").forEach((el) => (el.disabled = !on));
    });
  }

  function fieldError(el) {
    if (el.disabled) return false;
    if (el.type === "radio") {
      const group = el.form.querySelectorAll(`input[name="${el.name}"]`);
      return el.required && ![...group].some((r) => r.checked);
    }
    if (el.type === "checkbox") return el.required && !el.checked;
    const v = el.value.trim();
    if (el.required && !v) return true;
    if (v && el.type === "email" && !EMAIL_RE.test(v)) return true;
    if (v && el.type === "tel" && v.replace(/\D/g, "").length < 10) return true;
    return false;
  }

  function validate(form) {
    let first = null;
    form.querySelectorAll(".invalid").forEach((n) => n.classList.remove("invalid"));
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.name === "company_website" || el.type === "hidden") return;
      const bad = fieldError(el);
      if (el.type === "radio") {
        if (bad) el.closest("fieldset").classList.add("invalid");
      } else if (el.type === "checkbox") {
        el.closest(".check").classList.toggle("invalid", bad);
      } else {
        el.setAttribute("aria-invalid", String(bad));
      }
      if (bad && !first) first = el;
    });
    return first;
  }

  function payload(form) {
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = typeof v === "string" ? v.trim() : v));
    data.consent_contact = form.querySelector('[name="consent_contact"]').checked;
    data.consent_sms = form.querySelector('[name="consent_sms"]').checked;
    data.source_page = location.pathname;
    data.started_at = Number(form.dataset.startedAt || 0);
    return data;
  }

  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    form.dataset.startedAt = String(Date.now());
    syncExtras(form);
    const typeSel = form.querySelector('select[name="lead_type"]');
    if (typeSel) {
      // /contact?type=buyer preselects the path
      const pre = new URLSearchParams(location.search).get("type");
      if (pre && [...typeSel.options].some((o) => o.value === pre)) typeSel.value = pre;
      syncExtras(form);
      typeSel.addEventListener("change", () => syncExtras(form));
    }
    form.addEventListener("input", (e) => {
      if (e.target.getAttribute("aria-invalid") === "true" && !fieldError(e.target)) e.target.setAttribute("aria-invalid", "false");
    });
    form.addEventListener("change", (e) => {
      if (e.target.type === "radio") e.target.closest("fieldset")?.classList.remove("invalid");
      if (e.target.type === "checkbox") e.target.closest(".check")?.classList.remove("invalid");
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBox = form.querySelector(".form-error");
      errBox.hidden = true;
      const bad = validate(form);
      if (bad) {
        errBox.textContent = bad.name === "consent_contact"
          ? "Please check the box agreeing to be contacted so we can respond."
          : "Please fill in the highlighted fields.";
        errBox.hidden = false;
        bad.focus();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = "Sending…";
      try {
        const res = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(form)),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "Something went wrong. Please try again or call us.");
        form.querySelector(".form-body").hidden = true;
        form.querySelector(".form-title")?.setAttribute("hidden", "");
        const thanks = form.querySelector(".thanks");
        thanks.hidden = false;
        thanks.focus();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { lead_type: payload(form).lead_type });
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = label;
      }
    });
  });
})();
