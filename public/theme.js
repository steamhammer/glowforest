/**
 * Site-wide colour theme control.
 *
 * Loaded on every page. The head snippet has already applied a stored choice
 * before first paint; this module only reflects and updates it.
 */

const STORAGE_THEME = "glowforest-theme";

// Shared marker: every interactive control is styled to appear only under `.js`.
document.documentElement.classList.add("js");

function storedChoice() {
  try {
    const value = localStorage.getItem(STORAGE_THEME);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

const buttons = [...document.querySelectorAll("[data-theme-choice]")];

function mark(choice) {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", button.dataset.themeChoice === choice ? "true" : "false");
  }
}

function applyChoice(choice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.dataset.theme = choice;
    try {
      localStorage.setItem(STORAGE_THEME, choice);
    } catch {
      /* storage unavailable */
    }
  } else {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.removeItem(STORAGE_THEME);
    } catch {
      /* storage unavailable */
    }
  }
}

mark(storedChoice());

for (const button of buttons) {
  button.addEventListener("click", () => {
    const choice = button.dataset.themeChoice;
    applyChoice(choice);
    mark(choice);
  });
}
