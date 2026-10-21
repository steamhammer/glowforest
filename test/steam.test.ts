import { describe, expect, it } from "vitest";
import { createSteamClient } from "../src/metadata/steam";

function responder(handler: (body: URLSearchParams) => unknown): {
  fetchImpl: typeof fetch;
  bodies: URLSearchParams[];
} {
  const bodies: URLSearchParams[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ""));
    bodies.push(body);
    return new Response(JSON.stringify(handler(body)), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, bodies };
}

describe("Steam published-file details", () => {
  it("batches identifiers in groups of 100", async () => {
    const { fetchImpl, bodies } = responder((body) => {
      const count = Number(body.get("itemcount"));
      return {
        response: {
          publishedfiledetails: Array.from({ length: count }, (_, index) => ({
            publishedfileid: body.get(`publishedfileids[${index}]`),
            result: 1,
            title: `Mod ${index}`,
            preview_url: "https://images.example/thumb.png",
            file_size: "1000",
            subscriptions: "42",
            time_updated: "1700000000",
            tags: [{ tag: "Mod" }, { tag: "1.7" }, { tag: "1.6" }],
          })),
        },
      };
    });

    const client = createSteamClient({ fetch: fetchImpl });
    const ids = Array.from({ length: 150 }, (_, index) => String(1000 + index));
    const details = await client.getDetails(ids);

    expect(bodies).toHaveLength(2);
    expect(bodies[0].get("itemcount")).toBe("100");
    expect(bodies[1].get("itemcount")).toBe("50");
    expect(details).toHaveLength(150);
    expect(details[0].gameVersions).toEqual(["1.7", "1.6"]);
    expect(details[0].subs).toBe(42);
  });

  it("isolates failed and banned items", async () => {
    const { fetchImpl } = responder(() => ({
      response: {
        publishedfiledetails: [
          { publishedfileid: "1", result: 1, title: "Good", tags: [] },
          { publishedfileid: "2", result: 9 },
          { publishedfileid: "3", result: 1, banned: 1, title: "Banned" },
        ],
      },
    }));

    const client = createSteamClient({ fetch: fetchImpl });
    const details = await client.getDetails(["1", "2", "3"]);
    expect(details.map((item) => item.wid)).toEqual(["1"]);
  });

  it("returns nothing when the request fails", async () => {
    const client = createSteamClient({
      fetch: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    });
    expect(await client.getDetails(["1"])).toEqual([]);
  });

  it("returns nothing when the request times out", async () => {
    const client = createSteamClient({
      fetch: (async () => {
        throw new DOMException("timed out", "TimeoutError");
      }) as typeof fetch,
      timeoutMs: 10,
    });
    expect(await client.getDetails(["1"])).toEqual([]);
  });
});

describe("Steam collections", () => {
  it("reads the child items in order", async () => {
    const { fetchImpl, bodies } = responder(() => ({
      response: {
        collectiondetails: [
          {
            publishedfileid: "999",
            result: 1,
            children: [
              { publishedfileid: "111", sortorder: 0 },
              { publishedfileid: "222", sortorder: 1 },
            ],
          },
        ],
      },
    }));

    const client = createSteamClient({ fetch: fetchImpl });
    const collection = await client.getCollection("999");
    expect(collection?.children).toEqual(["111", "222"]);
    expect(bodies[0].get("collectioncount")).toBe("1");
    expect(bodies[0].get("publishedfileids[0]")).toBe("999");
  });

  it("returns null for a missing collection", async () => {
    const { fetchImpl } = responder(() => ({ response: { collectiondetails: [{ result: 9 }] } }));
    const client = createSteamClient({ fetch: fetchImpl });
    expect(await client.getCollection("1")).toBeNull();
  });
});
