// The creation wizard: one step at a time, with a designer for the look and the host and a phone that
// shows both as they change. Without this script the form still works: every step is shown at once and
// the ready-made looks and hosts are taken as they are.
(() => {
  const form = document.querySelector("form[data-wizard]");
  if (!form) return;
  const steps = [...form.querySelectorAll(".step")];
  const bar = form.querySelector(".bar i");
  const count = form.querySelector("[data-count]");
  const back = form.querySelector("[data-back]");
  const next = form.querySelector("[data-next]");
  const submit = form.querySelector("[data-submit]");
  const frame = document.querySelector("[data-frame]");
  const hostImg = document.querySelector("[data-host-img]");
  const rigs = JSON.parse(form.dataset.rigs);
  const faces = JSON.parse(form.dataset.faces);
  const el = (name) => form.elements[name];
  const picked = (name) => form.querySelector("input[name=" + name + "]:checked");
  const designer = (name) => form.querySelector('[data-designer="' + name + '"]');
  const words = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
  let at = Math.max(0, steps.findIndex((s) => s.querySelector(".error")));
  form.classList.add("js");

  function show(i, focus) {
    at = i;
    steps.forEach((s, n) => (s.hidden = n !== i));
    bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    count.textContent = "Step " + (i + 1) + " of " + steps.length;
    back.hidden = i === 0;
    next.hidden = i === steps.length - 1;
    submit.hidden = i !== steps.length - 1;
    if (focus) {
      const first = steps[i].querySelector("input:not([type=radio]):not([type=color]), textarea");
      if (first) first.focus();
    }
  }
  function stepIsValid() {
    for (const field of steps[at].querySelectorAll("input, textarea")) if (!field.reportValidity()) return false;
    return true;
  }
  next.addEventListener("click", () => stepIsValid() && show(at + 1, true));
  back.addEventListener("click", () => show(at - 1, true));
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && at < steps.length - 1) {
      e.preventDefault();
      next.click();
    }
  });

  // Suggestion chips add a word to the "feel" field.
  form.querySelectorAll("[data-add]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const field = el("tone");
      const list = field.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (!list.includes(chip.dataset.add)) list.push(chip.dataset.add);
      field.value = list.join(", ");
    }),
  );

  // A select shows only what the chosen kind of host offers; an empty list hides it.
  function offer(name, options, value) {
    const select = el(name);
    select.replaceChildren(...options.map((o) => new Option(words(o), o)));
    select.closest("label").hidden = !options.length;
    if (options.length) select.value = options.includes(value) ? value : options[0];
  }
  function fitHostControls(values) {
    const rig = rigs[el("h_rig").value];
    for (const key of ["shape", "extra", "hair", "eyes"]) offer("h_" + key, rig ? rig[key] : [], values["h_" + key]);
    el("h_mood").closest("label").hidden = !rig;
    form.querySelector("[data-host-inks]").hidden = !rig;
    form.querySelector("[data-ready-note]").hidden = Boolean(rig);
    if (!rig) return;
    el("h_shape").closest("label").firstChild.textContent = rig.shapeLabel;
    rig.colours.forEach((label, i) => (form.querySelector('[data-colour="' + i + '"]').textContent = label));
  }

  // Picking a ready-made look or host loads its settings into the designer.
  function load(values) {
    for (const [name, value] of Object.entries(values)) {
      const field = el(name);
      if (name === "l_display" && ![...field.options].some((o) => o.value === value)) field.add(new Option("Mixed faces", value));
      if (!["h_shape", "h_extra", "h_hair", "h_eyes"].includes(name)) field.value = value;
    }
    if ("h_rig" in values) fitHostControls(values);
    if ("l_frames" in values) showFrames();
  }

  // Scene layouts: tiles toggle presets in the look's frame list (JSON in l_frames), keeping any frames of the look's own.
  function frameList() {
    return el("l_frames").value ? JSON.parse(el("l_frames").value) : [];
  }
  function showFrames() {
    const on = new Set(frameList().filter((f) => typeof f === "string"));
    for (const tile of form.querySelectorAll("[data-frame-pick]")) tile.setAttribute("aria-pressed", String(on.has(tile.dataset.framePick)));
  }
  form.addEventListener("click", (e) => {
    const world = e.target.closest("[data-world]");
    if (world) {
      el("world").value = world.dataset.world;
      el("world").dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const tile = e.target.closest("[data-frame-pick]");
    if (!tile) return;
    const name = tile.dataset.framePick;
    const list = frameList();
    const next = list.includes(name) ? list.filter((f) => f !== name) : [...list, name];
    el("l_frames").value = next.length ? JSON.stringify(next) : "";
    showFrames();
  });

  function drawLook() {
    for (const [v, name] of [["paper", "l_paper"], ["card", "l_card"], ["ink", "l_ink"], ["text", "l_text"], ["a", "l_a"], ["b", "l_b"], ["c", "l_c"], ["accent", "l_accent"]]) frame.style.setProperty("--" + v, el(name).value);
    const display = faces[el("l_display").value.split(",")[0]];
    frame.style.setProperty("--displayf", "'" + display[0] + "'");
    frame.style.setProperty("--displayw", display[1]);
    frame.style.setProperty("--bodyf", "'" + faces[el("l_body").value][0] + "'");
    for (const key of ["casing", "surface", "backdrop", "art", "host", "host_size", "lettering", "pictures"]) frame.dataset[key] = el("l_" + key).value;
  }
  function drawHost() {
    const start = picked("avatar");
    if (designer("host").disabled) return void (hostImg.hidden = true);
    const src = rigs[el("h_rig").value] ? "/preview/host.svg?" + new URLSearchParams(["h_rig", "h_shape", "h_extra", "h_hair", "h_eyes", "h_main", "h_second", "h_accent", "h_mood"].map((k) => [k, el(k).value])) : start.dataset.pic;
    hostImg.hidden = !src;
    if (src) hostImg.src = src;
  }
  function drawWords() {
    const out = document.querySelector('[data-out="idea"]');
    out.textContent = el("idea").value.trim() || out.dataset.empty;
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "look") {
      designer("look").disabled = !t.dataset.preset;
      if (t.dataset.preset) load(JSON.parse(t.dataset.preset));
    }
    if (t.name === "avatar") {
      designer("host").disabled = !t.dataset.preset;
      if (t.dataset.preset) load(JSON.parse(t.dataset.preset));
    }
    if (t.name === "h_rig") fitHostControls({});
  });
  form.addEventListener("input", () => {
    drawWords();
    if (!designer("look").disabled) drawLook();
    drawHost();
  });

  // A ready 3D robot can only be chosen by starting from one.
  designer("look").disabled = !picked("look").dataset.preset;
  designer("host").disabled = !picked("avatar").dataset.preset;
  drawWords();
  if (!designer("look").disabled) drawLook();
  drawHost();
  show(at, false);
})();
