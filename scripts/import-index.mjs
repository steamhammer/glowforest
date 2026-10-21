#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const file = process.argv[2] ?? "steamDB.json";
const base = (process.argv[3] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN ?? "";

const payload = JSON.parse(await readFile(file, "utf8"));
const database = payload.database ?? {};

const rows = [];
for (const [wid, entry] of Object.entries(database)) {
  if (!entry || typeof entry !== "object") continue;
  // Store app entries describe official content, not Workshop items.
  if (entry.appid === true) continue;
  rows.push({
    wid,
    packageId: entry.packageId ? String(entry.packageId).toLowerCase() : null,
    name: entry.name ?? entry.steamName ?? null,
    authors: entry.authors ?? null,
    gameVersions: Array.isArray(entry.gameVersions) ? entry.gameVersions : [],
  });
}

console.log(`parsed ${rows.length} Workshop entries from ${file}`);

const batchSize = Number(process.env.BATCH_SIZE ?? 250);

async function sendBatch(batch, attempt = 1) {
  const response = await fetch(`${base}/__admin/import-index`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ rows: batch }),
  });
  if (response.ok) return true;
  const detail = await response.text();
  if (batch.length > 25 && attempt <= 3) {
    const half = Math.ceil(batch.length / 2);
    const first = await sendBatch(batch.slice(0, half), attempt + 1);
    const second = await sendBatch(batch.slice(half), attempt + 1);
    if (first && second) return true;
  }
  console.error(`\nbatch of ${batch.length} failed: ${response.status} ${detail}`);
  return false;
}

let failures = 0;
for (let offset = 0; offset < rows.length; offset += batchSize) {
  const batch = rows.slice(offset, offset + batchSize);
  const ok = await sendBatch(batch);
  if (!ok) failures += batch.length;
  process.stdout.write(`\r${Math.min(offset + batchSize, rows.length)}/${rows.length}${failures ? ` (${failures} failed)` : ""}`);
}
process.stdout.write(`\nimport complete: ${rows.length - failures} written, ${failures} failed\n`);
if (failures > 0) process.exit(1);
