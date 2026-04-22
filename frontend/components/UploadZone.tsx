"use client";

import { useRef, useState } from "react";

const MAX_IMAGES = 12;
const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadZoneProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onContinue: () => void;
}

export default function UploadZone({ files, onFilesAdded, onContinue }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function processFiles(rawFiles: FileList | File[]) {
    const fileArr = Array.from(rawFiles);
    const newErrors: string[] = [];
    const valid: UploadedFile[] = [];

    const remaining = MAX_IMAGES - files.length;

    for (const file of fileArr) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        newErrors.push(`${file.name}: only PNG and JPG accepted`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        newErrors.push(`${file.name}: exceeds 5 MB limit`);
        continue;
      }
      if (valid.length >= remaining) {
        newErrors.push(`Max ${MAX_IMAGES} images total`);
        break;
      }
      valid.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setErrors(newErrors);
    if (valid.length > 0) onFilesAdded(valid);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  }

  const canContinue = files.length >= 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Street View screenshots"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px ${dragActive ? "solid" : "dashed"} ${dragActive ? "var(--color-accent)" : "var(--color-border)"}`,
          borderRadius: 4,
          background: dragActive ? "var(--color-accent-bg)" : "var(--color-surface)",
          height: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={handleInputChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke={dragActive ? "var(--color-accent)" : "var(--color-muted)"}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p style={{ color: dragActive ? "var(--color-accent)" : "var(--color-muted)", fontSize: 14, margin: 0 }}>
          Drop PNG or JPG files, or click to select
        </p>
        <p style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
          Up to {MAX_IMAGES} images · 10 MB max per image
        </p>
      </div>

      {errors.length > 0 && (
        <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {errors.map((err, i) => (
            <p key={i} style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>
              {err}
            </p>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {files.map((f) => (
            <div key={f.id} style={{ position: "relative" }}>
              <img
                src={f.previewUrl}
                alt={f.file.name}
                style={{
                  width: 120,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 2,
                  border: "1px solid var(--color-border)",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {files.length > 0 && (
          <p style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
            {files.length} image{files.length !== 1 ? "s" : ""} selected
          </p>
        )}
        <button
          onClick={onContinue}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          aria-describedby={!canContinue ? "upload-hint" : undefined}
          style={{
            marginLeft: "auto",
            height: 44,
            minWidth: 180,
            background: canContinue ? "var(--color-accent)" : "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            fontSize: 14,
            fontWeight: 500,
            cursor: canContinue ? "pointer" : "not-allowed",
            opacity: canContinue ? 1 : 0.4,
            fontFamily: "var(--font-inter)",
          }}
        >
          Continue to ordering →
        </button>
      </div>
      {!canContinue && (
        <p id="upload-hint" style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
          Upload at least 1 image to continue
        </p>
      )}
    </div>
  );
}
