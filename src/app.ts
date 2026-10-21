import type { Env } from "./env";
import { createList, deleteList, getEditTokenHash, getItems, getList, updateItem, updateTitle } from "./db/lists";
import { importIndexRows, type IndexImportRow } from "./db/meta";
import { parseIngestedPayload, PayloadError, cleanNote, cleanTitle } from "./ingest/payload";
import { enrichItems, type EnrichedItem } from "./metadata/enrich";
import { createSteamClient, fetchCollectionTitle, type SteamClient } from "./metadata/steam";
import { allowRequest, clientBucket } from "./publish/rate-limit";
import { constantTimeEqual, newEditToken, newListId, sha256Hex, slugify } from "./publish/tokens";
import { getOrCreateCard, cardKey } from "./showcase/og-cache";
import { renderCardImage, type CardData } from "./showcase/og";
import { renderListPage, renderNotFound } from "./showcase/render";
import { summarise } from "./showcase/stats";
import type { IngestedList, RawMod } from "./types";

const CREATE_LIMIT = 10;
const CREATE_WINDOW_SECONDS = 3600;

export interface AppDependencies {
  now?: () => number;
  steam?: (env: Env) => SteamClient | null;
  renderCard?: (env: Env, request: Request, card: CardData) => Promise<Uint8Array>;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

function html(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extra,
    },
  });
}

function steamIdFromUrl(value: string): string | null {
  const match = /[?&]id=(\d+)/.exec(value);
  return match ? match[1] : null;
}

function collectionMods(children: string[]): RawMod[] {
  return children.map((steamId, index) => ({
    packageId: null,
    rawPackageId: null,
    steamId,
    name: null,
    index,
  }));
}

async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new HttpError(415, "expected application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

export function createApp(dependencies: AppDependencies = {}) {
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const steamFor =
    dependencies.steam ??
    ((env: Env) =>
      createSteamClient({ fetch, timeoutMs: Number(env.STEAM_TIMEOUT_MS ?? 5000) || 5000 }));
  const renderCard = dependencies.renderCard ?? renderCardImage;

  async function authorized(request: Request, env: Env, id: string): Promise<boolean> {
    const header = request.headers.get("x-edit-token");
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token = header ?? bearer ?? "";
    if (token.length === 0) return false;
    const stored = await getEditTokenHash(env.DB, id);
    if (stored === null) return false;
    return constantTimeEqual(await sha256Hex(token), stored);
  }

  async function loadEnriched(
    env: Env,
    id: string,
    withRefresh: boolean,
    ctx: ExecutionContext | undefined,
  ): Promise<{ list: NonNullable<Awaited<ReturnType<typeof getList>>>; items: EnrichedItem[] } | null> {
    const list = await getList(env.DB, id);
    if (list === null) return null;
    const records = await getItems(env.DB, id);
    const freshnessSeconds = Number(env.META_FRESHNESS_SECONDS ?? 604800) || 604800;
    const steam = steamFor(env);

    const items = await enrichItems(env.DB, records, {
      gameVersion: list.gameVersion,
      steam: null,
      now: now(),
      freshnessSeconds,
    });

    if (withRefresh && ctx && steam) {
      ctx.waitUntil(
        enrichItems(env.DB, records, {
          gameVersion: list.gameVersion,
          steam,
          now: now(),
          freshnessSeconds,
        }).then(() => undefined),
      );
    }

    return { list, items };
  }

  async function handleCreate(request: Request, env: Env): Promise<Response> {
    const allowed = await allowRequest(env.DB, clientBucket(request), {
      limit: CREATE_LIMIT,
      windowSeconds: CREATE_WINDOW_SECONDS,
      now: now(),
    });
    if (!allowed) throw new HttpError(429, "too many lists created from this address; try again later");

    const body = await readJson(request);
    const ingested = parseIngestedPayload(body);
    const record = body as Record<string, unknown>;

    const title = cleanTitle(record.title, ingested.defaultTitle ?? "Untitled mod list");
    const id = newListId();
    const token = newEditToken();
    const created = now();

    await createList(
      env.DB,
      {
        id,
        slug: slugify(title),
        title,
        source: ingested.source,
        gameVersion: ingested.gameVersion,
        tokenHash: await sha256Hex(token),
        now: created,
      },
      ingested.mods,
    );

    const steam = steamFor(env);
    if (steam) {
      const freshnessSeconds = Number(env.META_FRESHNESS_SECONDS ?? 604800) || 604800;
      const records = await getItems(env.DB, id);
      // Enrich once at creation so the first page view is already complete.
      await enrichItems(env.DB, records, {
        gameVersion: ingested.gameVersion,
        steam,
        now: now(),
        freshnessSeconds,
      });
    }

    const origin = new URL(request.url).origin;
    return json(
      {
        id,
        title,
        gameVersion: ingested.gameVersion,
        modCount: ingested.mods.length,
        url: `${origin}/l/${id}/${slugify(title)}`,
        editToken: token,
      },
      201,
    );
  }

  async function handleCollection(request: Request, env: Env): Promise<Response> {
    const body = await readJson(request);
    const record = body as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url : "";
    const id = steamIdFromUrl(url);
    if (id === null) throw new HttpError(400, "that does not look like a Steam Workshop collection URL");

    const steam = steamFor(env);
    if (!steam) throw new HttpError(503, "Steam lookups are unavailable");

    const collection = await steam.getCollection(id);
    if (collection === null || collection.children.length === 0) {
      throw new HttpError(404, "that collection is empty or could not be read");
    }

    const name = await fetchCollectionTitle(id, fetch);
    const ingested: IngestedList = {
      source: "collection",
      gameVersion: null,
      mods: collectionMods(collection.children),
      defaultTitle: name ?? `Workshop collection ${id}`,
    };
    return json(ingested);
  }

  async function handleShowList(
    request: Request,
    env: Env,
    ctx: ExecutionContext | undefined,
    id: string,
    slug: string | null,
  ): Promise<Response> {
    const loaded = await loadEnriched(env, id, true, ctx);
    if (loaded === null) return html(renderNotFound(), 404, { "x-robots-tag": "noindex, nofollow" });

    const { list, items } = loaded;
    const origin = new URL(request.url).origin;
    if (slug !== list.slug) {
      return Response.redirect(`${origin}/l/${list.id}/${list.slug}`, 301);
    }

    const page = renderListPage({
      list,
      items,
      canonicalUrl: `${origin}/l/${list.id}/${list.slug}`,
      ogImageUrl: `${origin}/og/${list.id}.png?v=${list.updatedAt}`,
    });
    return html(page, 200, {
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "public, max-age=60",
    });
  }

  async function handleCard(
    request: Request,
    env: Env,
    ctx: ExecutionContext | undefined,
    id: string,
  ): Promise<Response> {
    const loaded = await loadEnriched(env, id, false, ctx);
    if (loaded === null) return new Response("Not found", { status: 404 });

    const { list, items } = loaded;
    const stats = summarise(items, list.gameVersion);
    const key = cardKey(list.id, list.updatedAt);
    const bytes = await getOrCreateCard(env.PREVIEWS, key, { title: list.title, stats }, (card) =>
      renderCard(env, request, card),
    );

    return new Response(bytes, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  async function handleGetList(request: Request, env: Env, id: string): Promise<Response> {
    if (!(await authorized(request, env, id))) throw new HttpError(401, "a valid edit token is required");
    const loaded = await loadEnriched(env, id, false, undefined);
    if (loaded === null) throw new HttpError(404, "list not found");
    return json({
      list: loaded.list,
      items: loaded.items.map((item) => ({
        position: item.position,
        title: item.title,
        packageId: item.packageId,
        steamId: item.steamId,
        note: item.note,
        hidden: item.hidden,
        official: item.official,
        unresolved: item.unresolved,
      })),
    });
  }

  async function handleEdit(request: Request, env: Env, id: string): Promise<Response> {
    if (!(await authorized(request, env, id))) throw new HttpError(401, "a valid edit token is required");
    const body = await readJson(request);
    const record = body as Record<string, unknown>;
    const stamp = now();

    if (record.title !== undefined) {
      const title = cleanTitle(record.title, "Untitled mod list");
      await updateTitle(env.DB, id, title, slugify(title), stamp);
    }

    if (record.items !== undefined) {
      if (!Array.isArray(record.items)) throw new HttpError(400, "items must be an array");
      for (const entry of record.items) {
        if (typeof entry !== "object" || entry === null) throw new HttpError(400, "invalid item change");
        const change = entry as Record<string, unknown>;
        const position = Number(change.position);
        if (!Number.isInteger(position) || position < 0) throw new HttpError(400, "invalid position");
        const updated = await updateItem(
          env.DB,
          id,
          position,
          {
            note: change.note === undefined ? undefined : cleanNote(change.note),
            hidden: change.hidden === undefined ? undefined : Boolean(change.hidden),
          },
          stamp,
        );
        if (!updated) throw new HttpError(404, `no item at position ${position}`);
      }
    }

    const list = await getList(env.DB, id);
    return json({ ok: true, list });
  }

  async function handleDelete(request: Request, env: Env, id: string): Promise<Response> {
    if (!(await authorized(request, env, id))) throw new HttpError(401, "a valid edit token is required");
    await deleteList(env.DB, id);
    return json({ ok: true });
  }

  async function handleImportIndex(request: Request, env: Env): Promise<Response> {
    const configured = (env as Env & { ADMIN_TOKEN?: string }).ADMIN_TOKEN;
    const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const allowed =
      configured !== undefined && configured.length > 0
        ? constantTimeEqual(await sha256Hex(supplied), await sha256Hex(configured))
        : env.ENVIRONMENT !== "production";
    if (!allowed) throw new HttpError(401, "admin token required");

    const body = await readJson(request);
    const rows = (body as { rows?: unknown }).rows;
    if (!Array.isArray(rows)) throw new HttpError(400, "rows must be an array");
    try {
      const written = await importIndexRows(env.DB, rows as IndexImportRow[], now());
      return json({ written });
    } catch (error) {
      console.error("index import failed", error);
      return json({ error: error instanceof Error ? error.message : "import failed" }, 500);
    }
  }

  async function handleDiagnostic(env: Env): Promise<Response> {
    if (env.ENVIRONMENT === "production") throw new HttpError(404, "not found");
    const db = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    const previewMissing: boolean = (await env.PREVIEWS.head("__diagnostic__")) === null;
    return json({
      ok: db?.ok === 1,
      bindings: { DB: db?.ok === 1, PREVIEWS: previewMissing },
      environment: env.ENVIRONMENT,
    });
  }

  async function route(
    request: Request,
    env: Env,
    ctx: ExecutionContext | undefined,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const isGet = method === "GET" || method === "HEAD";
    const asHead = (response: Response): Response =>
      method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;

    if (path === "/__diagnostic" && isGet) return handleDiagnostic(env);
    if (path === "/__admin/import-index" && method === "POST") return handleImportIndex(request, env);

    if (path === "/api/lists" && method === "POST") return handleCreate(request, env);
    if (path === "/api/collections" && method === "POST") return handleCollection(request, env);

    const apiList = /^\/api\/lists\/([A-Za-z0-9_-]{1,64})$/.exec(path);
    if (apiList) {
      const id = apiList[1];
      if (method === "GET") return handleGetList(request, env, id);
      if (method === "PATCH") return handleEdit(request, env, id);
      if (method === "DELETE") return handleDelete(request, env, id);
      throw new HttpError(405, "method not allowed");
    }

    const og = /^\/og\/([A-Za-z0-9_-]{1,64})\.png$/.exec(path);
    if (og && isGet) return asHead(await handleCard(request, env, ctx, og[1]));

    const page = /^\/l\/([A-Za-z0-9_-]{1,64})(?:\/([^/]*))?$/.exec(path);
    if (page && isGet) return asHead(await handleShowList(request, env, ctx, page[1], page[2] ?? null));

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  }

  return {
    async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
      try {
        return await route(request, env, ctx);
      } catch (error) {
        if (error instanceof PayloadError) return json({ error: error.message }, 400);
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        console.error("unhandled error", error);
        return json({ error: "something went wrong" }, 500);
      }
    },
  };
}

