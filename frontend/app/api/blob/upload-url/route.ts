import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { filenames } = (await request.json()) as { filenames: string[] };

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return Response.json({ error: "filenames required" }, { status: 400 });
  }
  if (filenames.length > 12) {
    return Response.json({ error: "max 12 files" }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json({ error: "blob not configured" }, { status: 500 });
  }

  const now = Date.now();
  const entries = await Promise.all(
    filenames.map(async (filename, i) => {
      const pathname = `uploads/${now}-${i}-${filename}`;
      const clientToken = await generateClientTokenFromReadWriteToken({
        token,
        pathname,
        allowedContentTypes: ["image/png", "image/jpeg"],
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: false,
      });
      return { token: clientToken, pathname };
    })
  );

  return Response.json({ entries });
}
