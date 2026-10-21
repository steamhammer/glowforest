import type { CardData } from "./og";

export type CardRenderer = (card: CardData) => Promise<Uint8Array>;

export function cardKey(listId: string, updatedAt: number): string {
  return `og/${listId}-${updatedAt}.png`;
}

/** Read the cached card for this list revision, rendering it once if absent. */
export async function getOrCreateCard(
  bucket: R2Bucket,
  key: string,
  card: CardData,
  render: CardRenderer,
): Promise<Uint8Array> {
  const cached = await bucket.get(key);
  if (cached) return new Uint8Array(await cached.arrayBuffer());

  const bytes = await render(card);
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
  });
  return bytes;
}
