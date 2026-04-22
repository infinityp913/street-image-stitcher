import { put } from "@vercel/blob/client";

export async function uploadFilesToBlob(files: File[]): Promise<string[]> {
  const filenames = files.map((f) => f.name);

  const res = await fetch("/api/blob/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filenames }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get upload tokens");
  }

  const { entries } = (await res.json()) as { entries: { token: string; pathname: string }[] };

  // Use the exact pathname the token was signed for — mismatch causes a 403
  const results = await Promise.all(
    files.map((file, i) =>
      put(entries[i].pathname, file, {
        access: "public",
        token: entries[i].token,
      })
    )
  );

  return results.map((r) => r.url);
}
