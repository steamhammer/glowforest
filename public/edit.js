const statusEl = document.getElementById("status");
const editor = document.getElementById("editor");
const titleInput = document.getElementById("title-input");
const itemsEl = document.getElementById("items");
const saveButton = document.getElementById("save-button");
const deleteButton = document.getElementById("delete-button");
const viewLink = document.getElementById("view-link");

const match = /^#([A-Za-z0-9_-]+):(.+)$/.exec(location.hash);
if (!match) {
  setStatus("This edit link is incomplete. Use the edit link you saved when publishing.", "error");
} else {
  boot(match[1], match[2]);
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

async function boot(id, token) {
  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
      headers: { "x-edit-token": token },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "This list could not be opened.");
    render(payload.list, payload.items, token);
  } catch (error) {
    setStatus(error?.message ?? "This list could not be opened.", "error");
  }
}

function render(list, items, token) {
  titleInput.value = list.title;
  viewLink.href = `/l/${list.id}/${list.slug}`;
  itemsEl.replaceChildren(...items.map(renderItem));

  editor.hidden = false;
  setStatus("Loaded.");

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    setStatus("Saving…");
    const changes = [
      ...itemsEl.querySelectorAll(".editor-item"),
    ].map((element) => {
      const note = element.querySelector("textarea");
      const hidden = element.querySelector('input[type="checkbox"]');
      return {
        position: Number(element.dataset.position),
        note: note ? note.value : "",
        hidden: hidden ? hidden.checked : false,
      };
    });

    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-edit-token": token },
        body: JSON.stringify({ title: titleInput.value, items: changes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Saving failed.");
      setStatus("Saved.", "ok");
      if (payload.list) viewLink.href = `/l/${payload.list.id}/${payload.list.slug}`;
    } catch (error) {
      setStatus(error?.message ?? "Saving failed.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (!confirm("Delete this list permanently? The share URL will stop working.")) return;
    deleteButton.disabled = true;
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.id)}`, {
        method: "DELETE",
        headers: { "x-edit-token": token },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Deleting failed.");
      editor.hidden = true;
      setStatus("Deleted. This page can be closed.", "ok");
    } catch (error) {
      setStatus(error?.message ?? "Deleting failed.", "error");
      deleteButton.disabled = false;
    }
  });
}

function renderItem(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "editor-item";
  wrapper.dataset.position = String(item.position);

  const head = document.createElement("div");
  head.className = "editor-item-head";

  const title = document.createElement("span");
  title.className = "editor-item-title";
  title.textContent = `${item.position + 1}. ${item.title}`;

  const toggleLabel = document.createElement("label");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = Boolean(item.hidden);
  toggleLabel.append(toggle, document.createTextNode(" Hide from page"));

  const meta = document.createElement("span");
  meta.className = "editor-item-meta";
  meta.textContent = [item.packageId, item.official ? "official" : null, item.unresolved ? "not found on Workshop" : null]
    .filter(Boolean)
    .join(" · ");

  head.append(title, toggleLabel);

  const note = document.createElement("textarea");
  note.rows = 2;
  note.placeholder = "Why do you use this mod? (optional)";
  note.value = item.note ?? "";

  wrapper.append(head, meta, note);
  return wrapper;
}
