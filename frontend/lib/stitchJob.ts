const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const POLL_INTERVAL_MS = 3000;

interface StitchJobParams {
  blobUrls: string[];
  streetName: string;
  timestamp: string;
}

interface JobStatusResponse {
  status: "processing" | "done" | "error";
  pass?: number;
  total?: number;
  elapsed_s?: number;
  panorama_url?: string;
  message?: string;
  debug?: string;
}

export async function startStitchJob(params: StitchJobParams): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/stitch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blob_urls: params.blobUrls,
      street_name: params.streetName || null,
      timestamp: params.timestamp || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to start stitch job");
  }

  const { job_id } = (await res.json()) as { job_id: string };
  return job_id;
}

export async function pollJobUntilDone(
  jobId: string,
  onProgress: (msg: string) => void
): Promise<string> {
  const startedAt = Date.now();

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const res = await fetch(`${BACKEND_URL}/status/${jobId}`);

    if (res.status === 404) {
      throw new Error("Job lost — please stitch again.");
    }

    if (!res.ok) {
      throw new Error("Stitching failed — please try again.");
    }

    const data = (await res.json()) as JobStatusResponse;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);

    if (data.status === "processing") {
      if (data.pass != null && data.total != null) {
        onProgress(`Stitching pass ${data.pass} of ${data.total}... (${elapsed}s elapsed)`);
      } else {
        onProgress(`Stitching... (${elapsed}s elapsed)`);
      }
      continue;
    }

    if (data.status === "done" && data.panorama_url) {
      return data.panorama_url;
    }

    if (data.status === "error") {
      const msg = data.message ?? "Stitching failed — try fewer images or try again.";
      const detail = data.debug ? ` [${data.debug}]` : "";
      throw new Error(msg + detail);
    }

    onProgress(`Processing... (${elapsed}s elapsed)`);
  }
}
