// The channel studio's one script: copy buttons. A button's data-copy holds the text it puts on the clipboard.
document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
  if (!button) return;
  const label = button.textContent;
  navigator.clipboard.writeText(button.getAttribute("data-copy")).then(
    () => { button.textContent = "Copied"; setTimeout(() => (button.textContent = label), 1600); },
    () => { button.textContent = "Couldn't copy: select the caption and copy it"; },
  );
});
