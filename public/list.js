/**
 * Showcase page enhancement.
 *
 * Everything here is progressive: without this script the page still renders
 * the full list and the only interactive control is the mode link.
 */

const SEARCH_DELAY = 120;

/** Lowercase and strip diacritics; mirrors the server's haystack normalisation. */
export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * @param {{ official: boolean, unresolved: boolean, outdated: boolean, noted: boolean, search: string }} mod
 * @param {string} query
 * @param {{ onlyUnresolved?: boolean, onlyOutdated?: boolean, onlyNoted?: boolean }} filters
 */
export function matches(mod, query, filters = {}) {
  if (filters.onlyUnresolved && !mod.unresolved) return false;
  if (filters.onlyOutdated && !mod.outdated) return false;
  if (filters.onlyNoted && !mod.noted) return false;
  const needle = normalize(query).trim();
  if (needle.length > 0 && !mod.search.includes(needle)) return false;
  return true;
}

/** Ordered list text for pasting into a chat thread. */
export function listAsText(mods) {
  return mods
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((mod) => `${mod.position}. ${mod.title}${mod.author ? ` (${mod.author})` : ""}`)
    .join("\n");
}

if (typeof document !== "undefined") {
  document.documentElement.classList.add("js");
  wire();
}

function wire() {
  const main = document.querySelector("main.page");
  if (!main) return;

  const cards = [...document.querySelectorAll(".mod")].map((el) => ({
    el,
    position: Number(el.dataset.position),
    title: el.dataset.title ?? "",
    author: el.dataset.author ?? "",
    search: el.dataset.search ?? "",
    official: el.dataset.official === "1",
    unresolved: el.dataset.unresolved === "1",
    outdated: el.dataset.outdated === "1",
    noted: el.dataset.noted === "1",
  }));
  const total = cards.length;
  if (total === 0) return;

  const groups = [...document.querySelectorAll('[data-official-group="true"]')];
  const searchInput = document.getElementById("mod-search");
  const counter = document.getElementById("match-count");
  const emptyState = document.getElementById("list-empty");
  const clearButton = document.querySelector("[data-clear]");
  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  const copyListButton = document.getElementById("copy-list");
  const modeToggle = document.querySelector("[data-mode-toggle]");

  const filters = {
    onlyUnresolved: false,
    onlyOutdated: false,
    onlyNoted: false,
  };
  const filterKeys = {
    "only-unresolved": "onlyUnresolved",
    "only-outdated": "onlyOutdated",
    "only-noted": "onlyNoted",
  };

  function activeFilters() {
    return filterButtons
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.dataset.filter);
  }

  function apply() {
    const query = searchInput ? searchInput.value : "";
    let shown = 0;

    for (const card of cards) {
      const visible = matches(card, query, filters);
      card.el.hidden = !visible;
      if (visible) shown += 1;
    }

    for (const group of groups) {
      const visibleChildren = group.querySelectorAll(".mod:not([hidden])").length;
      group.hidden = visibleChildren === 0;
    }

    const filtering = query.trim().length > 0 || activeFilters().length > 0;
    if (counter) {
      counter.hidden = !filtering;
      counter.textContent = filtering ? `${shown} of ${total} shown` : "";
    }
    if (emptyState) emptyState.hidden = shown > 0;
    if (clearButton) clearButton.hidden = !filtering;
    return shown;
  }

  function syncUrl() {
    const url = new URL(location.href);
    const query = searchInput ? searchInput.value.trim() : "";
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  }

  let searchTimer;
  if (searchInput) {
    const initial = new URL(location.href).searchParams.get("q");
    if (initial) searchInput.value = initial;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        apply();
        syncUrl();
      }, SEARCH_DELAY);
    });
  }

  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      const key = filterKeys[button.dataset.filter];
      if (!key) return;
      filters[key] = !filters[key];
      button.setAttribute("aria-pressed", filters[key] ? "true" : "false");
      apply();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      for (const button of filterButtons) {
        filters[filterKeys[button.dataset.filter]] = false;
        button.setAttribute("aria-pressed", "false");
      }
      if (searchInput) searchInput.value = "";
      apply();
      syncUrl();
    });
  }

  if (modeToggle) {
    modeToggle.addEventListener("click", () => {
      const next = main.dataset.mode === "brief" ? "detailed" : "brief";
      main.dataset.mode = next;
      modeToggle.setAttribute("aria-pressed", next === "brief" ? "true" : "false");
      const url = new URL(location.href);
      if (next === "brief") url.searchParams.set("mode", "brief");
      else url.searchParams.delete("mode");
      history.replaceState(null, "", url);
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function flash(button, message) {
    const original = button.textContent;
    button.textContent = message;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  }

  if (copyListButton) {
    copyListButton.addEventListener("click", async () => {
      const visible = cards.filter((card) => !card.el.hidden);
      const ok = await copyText(listAsText(visible));
      flash(copyListButton, ok ? "Copied" : "Copy failed");
    });
  }

  apply();
}
