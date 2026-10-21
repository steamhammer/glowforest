import { extractFromFile } from "./extract.js";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const form = document.getElementById("publish-form");
const titleInput = document.getElementById("title-input");
const detectedEl = document.getElementById("detected");
const publishButton = document.getElementById("publish-button");
const resultPanel = document.getElementById("result-panel");
const collectionForm = document.getElementById("collection-form");
const collectionUrl = document.getElementById("collection-url");

/** @type {{ source: string, gameVersion: string | null, mods: any[], defaultTitle: string | null } | null} */
let pending = null;

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function showPending(ingested) {
  pending = ingested;
  form.hidden = false;
  const label = ingested.mods.length === 1 ? "mod" : "mods";
  const version = ingested.gameVersion ? ` · RimWorld ${ingested.gameVersion.split(" ")[0]}` : "";
  detectedEl.textContent = `Detected ${ingested.mods.length} ${label} from ${describeSource(ingested.source)}${version}.`;
  titleInput.value = ingested.defaultTitle ?? "";
  titleInput.focus();
  setStatus("");
}

function describeSource(source) {
  switch (source) {
    case "rws":
      return "a save file";
    case "rml":
      return "a mod-list export";
    case "modsconfig":
      return "ModsConfig.xml";
    case "collection":
      return "a Workshop collection";
    default:
      return "your file";
  }
}

async function handleFile(file) {
  setStatus("Reading the mod-list header…");
  form.hidden = true;
  pending = null;
  try {
    const ingested = await extractFromFile(file, { filename: file.name });
    showPending(ingested);
  } catch (error) {
    setStatus(error?.message ?? "That file could not be read.", "error");
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

for (const event of ["dragenter", "dragover"]) {
  dropzone.addEventListener(event, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  });
}
for (const event of ["dragleave", "drop"]) {
  dropzone.addEventListener(event, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
  });
}
dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pending) return;
  publishButton.disabled = true;
  setStatus("Publishing…");
  try {
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...pending, title: titleInput.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Publishing failed.");

    const editUrl = `${location.origin}/edit.html#${payload.id}:${payload.editToken}`;
    document.getElementById("share-url").value = payload.url;
    document.getElementById("edit-url").value = editUrl;
    document.getElementById("view-link").href = payload.url;
    resultPanel.hidden = false;
    form.hidden = true;
    setStatus(`Published ${payload.modCount} mods.`, "ok");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(error?.message ?? "Publishing failed.", "error");
  } finally {
    publishButton.disabled = false;
  }
});

collectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = collectionUrl.value.trim();
  if (!url) return;
  setStatus("Reading the collection from Steam…");
  form.hidden = true;
  pending = null;
  try {
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "That collection could not be read.");
    showPending(payload);
  } catch (error) {
    setStatus(error?.message ?? "That collection could not be read.", "error");
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.copy) {
    const input = document.getElementById(target.dataset.copy);
    if (input instanceof HTMLInputElement) {
      await navigator.clipboard.writeText(input.value);
      target.textContent = "Copied";
      setTimeout(() => (target.textContent = "Copy"), 1500);
    }
  }

  if (target.classList.contains("copy-path")) {
    const code = target.parentElement?.querySelector(".path");
    if (code) {
      await navigator.clipboard.writeText(code.dataset.path ?? code.textContent ?? "");
      target.textContent = "Copied";
      setTimeout(() => (target.textContent = "Copy"), 1500);
    }
  }
});
