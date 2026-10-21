export interface Env {
  DB: D1Database;
  PREVIEWS: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  META_FRESHNESS_SECONDS: string;
  STEAM_TIMEOUT_MS: string;
}
