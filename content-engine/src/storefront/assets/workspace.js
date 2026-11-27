// The workspace page: save a decision in place, so the page never reloads or jumps.
// Without this script every form still works as a normal post.
(() => {
  const parts = () => document.querySelectorAll("[data-live][id]");

  function say(card, text) {
    let alert = card.querySelector("[role=alert]");
    if (!alert) {
      alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.className = "error";
      card.append(alert);
    }
    alert.textContent = text;
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-live-form")) return;
    event.preventDefault();
    const card = form.closest("[data-live]");
    card.setAttribute("aria-busy", "true");
    let res;
    let html;
    try {
      res = await fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)), headers: { "content-type": "application/x-www-form-urlencoded" } });
      html = await res.text();
    } catch {
      card.removeAttribute("aria-busy");
      say(card, "That was not saved: the connection dropped. Try again.");
      return;
    }
    const next = new DOMParser().parseFromString(html, "text/html");
    if (!res.ok) {
      card.removeAttribute("aria-busy");
      say(card, next.querySelector(".lede")?.textContent || "That was not saved. Try again.");
      return;
    }
    // The answer is the whole updated page: take the parts that show decisions from it.
    for (const old of parts()) {
      const fresh = next.getElementById(old.id);
      if (fresh) old.replaceWith(fresh);
      else old.remove();
    }
    document.getElementById(card.id)?.querySelector("button, summary")?.focus({ preventScroll: true });
  });

  document.addEventListener("click", (event) => {
    const close = event.target instanceof Element ? event.target.closest("[data-close]") : null;
    if (close) close.closest("details").open = false;
  });

  document.addEventListener("toggle", (event) => {
    if (event.target instanceof HTMLDetailsElement && event.target.open) event.target.querySelector("textarea")?.focus({ preventScroll: true });
  }, true);
})();
