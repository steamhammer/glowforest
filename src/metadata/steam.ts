export interface SteamDetails {
  wid: string;
  creator: string | null;
  title: string | null;
  thumb: string | null;
  description: string | null;
  fileSize: number | null;
  subs: number | null;
  gameVersions: string[];
  updatedAt: number | null;
}

export interface SteamCollection {
  id: string;
  children: string[];
  name: string | null;
}

export interface SteamClient {
  getDetails(wids: string[]): Promise<SteamDetails[]>;
  getCollection(id: string): Promise<SteamCollection | null>;
}

const DETAILS_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";
const COLLECTION_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toVersions(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const versions: string[] = [];
  for (const tag of tags) {
    const value =
      typeof tag === "object" && tag !== null
        ? (tag as { tag?: unknown }).tag
        : undefined;
    if (typeof value === "string" && /^\d+\.\d+$/.test(value)) versions.push(value);
  }
  return versions;
}

function chunks<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

export interface SteamClientOptions {
  fetch: typeof fetch;
  timeoutMs?: number;
}

export function createSteamClient(options: SteamClientOptions): SteamClient {
  const doFetch = options.fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  async function post(url: string, body: URLSearchParams): Promise<unknown> {
    const response = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return response.json();
  }

  return {
    async getDetails(wids: string[]): Promise<SteamDetails[]> {
      const details: SteamDetails[] = [];
      for (const batch of chunks([...new Set(wids)], 100)) {
        const form = new URLSearchParams();
        form.set("itemcount", String(batch.length));
        batch.forEach((wid, index) => form.set(`publishedfileids[${index}]`, wid));

        let payload: unknown;
        try {
          payload = await post(DETAILS_URL, form);
        } catch {
          // Per-batch isolation: a failure never breaks the page.
          continue;
        }

        const items = (payload as { response?: { publishedfiledetails?: unknown } })?.response
          ?.publishedfiledetails;
        if (!Array.isArray(items)) continue;

        for (const raw of items) {
          if (typeof raw !== "object" || raw === null) continue;
          const item = raw as Record<string, unknown>;
          // result 1 means found; 9 means deleted/not found.
          if (Number(item.result) !== 1) continue;
          if (Number(item.banned) === 1) continue;
          const wid = String(item.publishedfileid ?? "");
          if (!wid) continue;
          details.push({
            wid,
            creator: item.creator === undefined || item.creator === null ? null : String(item.creator),
            title: typeof item.title === "string" ? item.title : null,
            thumb: typeof item.preview_url === "string" ? item.preview_url : null,
            description: typeof item.description === "string" ? item.description : null,
            fileSize: toNumber(item.file_size),
            subs: toNumber(item.subscriptions),
            gameVersions: toVersions(item.tags),
            updatedAt: toNumber(item.time_updated),
          });
        }
      }
      return details;
    },

    async getCollection(id: string): Promise<SteamCollection | null> {
      const form = new URLSearchParams();
      form.set("collectioncount", "1");
      form.set("publishedfileids[0]", id);

      let payload: unknown;
      try {
        payload = await post(COLLECTION_URL, form);
      } catch {
        return null;
      }

      const collections = (payload as { response?: { collectiondetails?: unknown } })?.response
        ?.collectiondetails;
      if (!Array.isArray(collections) || collections.length === 0) return null;

      const entry = collections[0] as Record<string, unknown>;
      if (Number(entry.result) !== 1) return null;
      const children = Array.isArray(entry.children) ? entry.children : [];

      return {
        id,
        children: children
          .map((child) =>
            typeof child === "object" && child !== null
              ? String((child as Record<string, unknown>).publishedfileid ?? "")
              : "",
          )
          .filter((value) => value.length > 0),
        name: null,
      };
    },
  };
}

/** Best-effort collection title from its public page; null when unavailable. */
export async function fetchCollectionTitle(
  id: string,
  fetchImpl: typeof fetch,
  timeoutMs = 4000,
): Promise<string | null> {
  try {
    const response = await fetchImpl(
      `https://steamcommunity.com/sharedfiles/filedetails/?id=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "modlist-showcase/0.1" } },
    );
    if (!response.ok) return null;
    const text = await response.text();
    const match = /<div class="workshopItemTitle">([\s\S]*?)<\/div>/.exec(text);
    if (!match) return null;
    const title = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    return title.length > 0 ? title.slice(0, 120) : null;
  } catch {
    return null;
  }
}
