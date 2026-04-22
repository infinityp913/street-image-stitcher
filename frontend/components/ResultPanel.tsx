"use client";

import { useEffect, useRef } from "react";

interface ResultPanelProps {
  panoramaUrl: string;
  imageCount: number;
  streetName: string;
  timestamp: string;
  onStitchAgain: () => void;
}

export default function ResultPanel({
  panoramaUrl,
  imageCount,
  streetName,
  timestamp,
  onStitchAgain,
}: ResultPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const subtitle = streetName
    ? streetName + (timestamp ? ` · ${timestamp}` : "")
    : timestamp;

  const downloadFilename = (() => {
    const base = streetName
      ? streetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
      : "street-panorama";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${base}-${date}.png`;
  })();

  async function handleDownload() {
    const res = await fetch(panoramaUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      ref={panelRef}
      style={{
        animation: "slideUp 300ms ease-out forwards",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div>
        <h2
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--color-text)",
            margin: "0 0 4px 0",
          }}
        >
          Your street elevation is ready — {imageCount} images stitched
        </h2>
        {subtitle && (
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: 14,
              color: "var(--color-muted)",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0 0" }}>
          Download link expires in 24 hours.
        </p>
      </div>

      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--color-border)",
          borderRadius: 2,
        }}
      >
        <img
          src={panoramaUrl}
          alt={`Street elevation panoramic of ${imageCount} images${streetName ? ": " + streetName : ""}${timestamp ? ", " + timestamp : ""}`}
          style={{
            display: "block",
            height: 240,
            width: "auto",
            maxWidth: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleDownload}
          aria-label="Download panoramic as PNG"
          style={{
            height: 44,
            minWidth: 160,
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-inter)",
          }}
        >
          ↓ Download PNG
        </button>
        <button
          onClick={onStitchAgain}
          style={{
            height: 44,
            minWidth: 160,
            background: "none",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
            borderRadius: 2,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-inter)",
          }}
        >
          ← Stitch again
        </button>
      </div>
    </div>
  );
}
