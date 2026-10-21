export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  now: number;
}

/** Fixed-window counter. Returns true when the request is allowed. */
export async function allowRequest(
  db: D1Database,
  bucket: string,
  options: RateLimitOptions,
): Promise<boolean> {
  const windowStart = options.now - (options.now % options.windowSeconds);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END
       RETURNING count`,
    )
    .bind(bucket, windowStart, windowStart, windowStart, windowStart)
    .first<{ count: number }>();

  return Number(row?.count ?? 1) <= options.limit;
}

export function clientBucket(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return `create:${ip ?? "unknown"}`;
}
