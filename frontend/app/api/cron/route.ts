import { list, del } from "@vercel/blob";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const RAILWAY_URL = process.env.RAILWAY_BACKEND_URL;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results: { keepAlive?: string; deleted?: number; error?: string } = {};

  // Ping Railway to keep it warm
  if (RAILWAY_URL) {
    try {
      const res = await fetch(`${RAILWAY_URL}/health`, { signal: AbortSignal.timeout(10000) });
      results.keepAlive = res.ok ? "ok" : `status ${res.status}`;
    } catch {
      results.keepAlive = "unreachable";
    }
  }

  // Delete Vercel Blobs older than 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  let cursor: string | undefined;

  try {
    do {
      const page = await list({ cursor, limit: 100 });
      const toDelete = page.blobs
        .filter((b) => new Date(b.uploadedAt).getTime() < cutoff)
        .map((b) => b.url);

      if (toDelete.length > 0) {
        await del(toDelete);
        deletedCount += toDelete.length;
      }

      cursor = page.cursor;
    } while (cursor);

    results.deleted = deletedCount;
  } catch (err) {
    results.error = err instanceof Error ? err.message : "blob cleanup failed";
  }

  return Response.json(results);
}
