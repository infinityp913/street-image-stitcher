"use client";

import { useRef, useState } from "react";
import StepIndicator from "../components/StepIndicator";
import UploadZone, { UploadedFile } from "../components/UploadZone";
import OrderStrip, { OrderMetadata } from "../components/OrderStrip";
import ResultPanel from "../components/ResultPanel";
import { uploadFilesToBlob } from "../lib/blobUpload";
import { startStitchJob, pollJobUntilDone } from "../lib/stitchJob";

type Step = 1 | 2 | 3;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [metadata, setMetadata] = useState<OrderMetadata>({
    streetName: "",
    timestamp: "",
  });
  const [stitching, setStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState<string | null>(null);
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);

  const addMoreInputRef = useRef<HTMLInputElement>(null);

  function handleFilesAdded(newFiles: UploadedFile[]) {
    setFiles((prev) => [...prev, ...newFiles].slice(0, 12));
  }

  function handleReorder(reordered: UploadedFile[]) {
    setFiles(reordered);
  }

  function handleRemove(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleAddMore() {
    addMoreInputRef.current?.click();
  }

  function handleAddMoreChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles: UploadedFile[] = [];
    const rawFiles = Array.from(e.target.files);
    const remaining = 12 - files.length;
    for (const file of rawFiles.slice(0, remaining)) {
      if (!["image/png", "image/jpeg"].includes(file.type)) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      newFiles.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, 12));
    e.target.value = "";
  }

  async function handleStitch() {
    setStitchError(null);
    setStitching(true);
    setStitchProgress("Uploading images...");

    let blobUrls: string[];
    try {
      blobUrls = await uploadFilesToBlob(files.map((f) => f.file));
    } catch {
      setStitchError("Upload failed. Please try again.");
      setStitching(false);
      setStitchProgress(null);
      return;
    }

    let jobId: string;
    try {
      setStitchProgress("Starting stitching job...");
      jobId = await startStitchJob({
        blobUrls,
        streetName: metadata.streetName,
        timestamp: metadata.timestamp,
      });
    } catch {
      setStitchError("Could not start stitching. Please try again.");
      setStitching(false);
      setStitchProgress(null);
      return;
    }

    try {
      const resultUrl = await pollJobUntilDone(jobId, (progress) => {
        setStitchProgress(progress);
      });
      setPanoramaUrl(resultUrl);
      setStep(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stitching failed — try fewer images or try again.";
      setStitchError(message);
    } finally {
      setStitching(false);
      setStitchProgress(null);
    }
  }

  function handleStitchAgain() {
    setStep(2);
    setPanoramaUrl(null);
    setStitchError(null);
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "40px 24px 80px",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-text)",
            margin: "0 0 16px 0",
            letterSpacing: "-0.01em",
          }}
        >
          Street Image Stitcher
        </h1>
        <StepIndicator current={step} />
      </header>

      {step === 1 && (
        <section aria-label="Upload">
          <UploadZone
            files={files}
            onFilesAdded={handleFilesAdded}
            onContinue={() => setStep(2)}
          />
        </section>
      )}

      {step === 2 && (
        <section aria-label="Order">
          <input
            ref={addMoreInputRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={handleAddMoreChange}
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <OrderStrip
            files={files}
            metadata={metadata}
            onReorder={handleReorder}
            onRemove={handleRemove}
            onMetadataChange={setMetadata}
            onAddMore={handleAddMore}
            onStitch={handleStitch}
            stitching={stitching}
            stitchProgress={stitchProgress}
            stitchError={stitchError}
          />
        </section>
      )}

      {step === 3 && panoramaUrl && (
        <section aria-label="Result">
          <ResultPanel
            panoramaUrl={panoramaUrl}
            imageCount={files.length}
            streetName={metadata.streetName}
            timestamp={metadata.timestamp}
            onStitchAgain={handleStitchAgain}
          />
        </section>
      )}
    </main>
  );
}
