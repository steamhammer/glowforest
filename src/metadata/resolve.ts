import type { WorkshopIndexRow } from "../types";
import { PLACEHOLDER_PACKAGE_IDS } from "./official";

/** "1.7.4976 rev1043" -> "1.7" */
export function majorMinor(version: string | null | undefined): string | null {
  if (!version) return null;
  const match = /^(\d+)\.(\d+)/.exec(version.trim());
  return match ? `${match[1]}.${match[2]}` : null;
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameScore(a: string | null | undefined, b: string | null | undefined): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 50;
  if (left.includes(right) || right.includes(left)) return 30;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  const union = leftTokens.size + rightTokens.size - shared;
  return union === 0 ? 0 : Math.round((shared / union) * 40);
}

export function isPlaceholder(packageId: string | null): boolean {
  return packageId !== null && PLACEHOLDER_PACKAGE_IDS.has(packageId.toLowerCase());
}

/**
 * Pick one Workshop item for a package id deterministically:
 * game-version match first, then name similarity, then the lowest Workshop id.
 */
export function pickCandidate(
  candidates: WorkshopIndexRow[],
  context: { gameVersion: string | null; name: string | null },
): WorkshopIndexRow | null {
  if (candidates.length === 0) return null;
  const wanted = majorMinor(context.gameVersion);

  const scored = candidates.map((candidate) => {
    const versionMatch =
      wanted !== null && candidate.gameVersions.includes(wanted) ? 100 : 0;
    return { candidate, score: versionMatch + nameScore(context.name, candidate.name) };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const left = BigInt(a.candidate.wid);
    const right = BigInt(b.candidate.wid);
    return left < right ? -1 : left > right ? 1 : 0;
  });

  return scored[0].candidate;
}

/** `crows.dustbunny` -> `crows`; null when there is no namespace segment. */
export function packageNamespace(packageId: string | null): string | null {
  if (!packageId) return null;
  const dot = packageId.indexOf(".");
  if (dot <= 0 || dot === packageId.length - 1) return null;
  return packageId.slice(0, dot).toLowerCase();
}

/**
 * Choose between same-titled items by author: accept a candidate only when it
 * and no other candidate shares a Workshop creator with the namespace's
 * already-resolved mods.
 */
export function pickByCreator(
  candidateWids: string[],
  siblingWids: string[],
  creatorOf: (wid: string) => string | null,
): string | null {
  const known = new Set<string>();
  for (const wid of siblingWids) {
    const creator = creatorOf(wid);
    if (creator !== null) known.add(creator);
  }
  if (known.size === 0) return null;

  const matches = candidateWids.filter((wid) => {
    const creator = creatorOf(wid);
    return creator !== null && known.has(creator);
  });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Choose a Workshop item for a package id that the index does not know, using
 * only entries that carry no package id of their own. A single candidate wins;
 * several candidates must be separated by game-version support, otherwise the
 * mod stays unresolved instead of receiving a guess.
 */
export function pickByTitle(
  candidates: WorkshopIndexRow[],
  gameVersion: string | null,
): WorkshopIndexRow | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const wanted = majorMinor(gameVersion);
  if (wanted === null) return null;
  const supporting = candidates.filter((candidate) => candidate.gameVersions.includes(wanted));
  return supporting.length === 1 ? supporting[0] : null;
}
