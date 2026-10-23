/**
 * Site-wide colour theme switch.
 *
 * Loaded on every page. The head snippet has already applied a stored choice
 * before first paint; this module reflects it on the checkbox and toggles it.
 * With nothing stored the page follows the system preference and the switch
 * mirrors that, without writing a choice.
 */

const STORAGE_THEME = "glowforest-theme";

// Shared marker: every interactive control is styled to appear only under `.js`.
document.documentElement.classList.add("js");

const switches = [...document.querySelectorAll("[data-theme-switch]")];
const system = window.matchMedia("(prefers-color-scheme: dark)");

function storedChoice() {
  try {
    const value = localStorage.getItem(STORAGE_THEME);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* storage unavailable */
  }
  return null;
}

function systemTheme() {
  return system.matches ? "dark" : "light";
}

function activeTheme() {
  return storedChoice() ?? systemTheme();
}

function paint(theme) {
  for (const control of switches) {
    control.checked = theme === "dark";
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_THEME, theme);
  } catch {
    /* storage unavailable: the choice holds for this page only */
  }
  paint(theme);
}

paint(activeTheme());

for (const control of switches) {
  control.addEventListener("change", () => {
    apply(control.checked ? "dark" : "light");
  });
}

// Follow the system while no explicit choice exists.
system.addEventListener("change", () => {
  if (storedChoice() === null) paint(systemTheme());
});
