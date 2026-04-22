"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { UploadedFile } from "./UploadZone";

export interface OrderMetadata {
  streetName: string;
  timestamp: string;
}

interface OrderStripProps {
  files: UploadedFile[];
  metadata: OrderMetadata;
  onReorder: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  onMetadataChange: (meta: OrderMetadata) => void;
  onAddMore: () => void;
  onStitch: () => void;
  stitching: boolean;
  stitchProgress: string | null;
  stitchError: string | null;
}

export default function OrderStrip({
  files,
  metadata,
  onReorder,
  onRemove,
  onMetadataChange,
  onAddMore,
  onStitch,
  stitching,
  stitchProgress,
  stitchError,
}: OrderStripProps) {
  const canStitch = files.length >= 2 && !stitching;

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(files);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onReorder(reordered);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      const reordered = Array.from(files);
      [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
      onReorder(reordered);
    } else if (e.key === "ArrowRight" && index < files.length - 1) {
      e.preventDefault();
      const reordered = Array.from(files);
      [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
      onReorder(reordered);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--color-text)",
    fontFamily: "var(--font-inter)",
    marginBottom: 4,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    border: "1px solid var(--color-border)",
    borderRadius: 2,
    padding: "0 10px",
    fontSize: 14,
    fontFamily: "var(--font-inter)",
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
        <div>
          <label htmlFor="street-name" style={labelStyle}>
            Street name <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="street-name"
            type="text"
            placeholder="e.g., Looking east along Park Street"
            value={metadata.streetName}
            onChange={(e) => onMetadataChange({ ...metadata, streetName: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="timestamp" style={labelStyle}>
            Timestamp <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="timestamp"
            type="text"
            placeholder="e.g., March 2024"
            value={metadata.timestamp}
            onChange={(e) => onMetadataChange({ ...metadata, timestamp: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 12px 0" }}>
          Drag images left → right in the order they appear along the street:
        </p>

        {/* Outer scroll container — DnD needs fixed-height, no-wrap to work correctly */}
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="order-strip" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  role="listbox"
                  aria-label="Image order"
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    gap: 8,
                    minHeight: 160,
                    width: "max-content",
                  }}
                >
                  {files.map((file, index) => (
                    <Draggable key={file.id} draggableId={file.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          role="option"
                          aria-selected={false}
                          aria-grabbed={snapshot.isDragging}
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          style={{
                            position: "relative",
                            width: 200,
                            flexShrink: 0,
                            cursor: "grab",
                            border: snapshot.isDragging
                              ? "2px solid var(--color-accent)"
                              : "1px solid var(--color-border)",
                            borderRadius: 2,
                            transform: snapshot.isDragging ? "scale(1.03)" : "scale(1)",
                            transition: "transform 150ms",
                            background: "var(--color-surface)",
                            ...provided.draggableProps.style,
                          }}
                        >
                          <img
                            src={file.previewUrl}
                            alt={`Image ${index + 1}: ${file.file.name}`}
                            style={{
                              width: 200,
                              height: 130,
                              objectFit: "cover",
                              display: "block",
                            }}
                            draggable={false}
                          />
                          <div
                            style={{
                              height: 20,
                              background: "var(--color-surface)",
                              display: "flex",
                              alignItems: "center",
                              paddingLeft: 4,
                              fontSize: 11,
                              color: "var(--color-muted)",
                              fontFamily: "var(--font-inter)",
                              borderTop: "1px solid var(--color-border)",
                            }}
                          >
                            {index + 1}
                          </div>
                          <span
                            style={{
                              position: "absolute",
                              top: 4,
                              left: 4,
                              width: 20,
                              height: 20,
                              background: "var(--color-accent)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 2,
                              fontFamily: "var(--font-inter)",
                            }}
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
                            aria-label={`Remove image ${index + 1}`}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 20,
                              height: 20,
                              background: "#666",
                              color: "#fff",
                              border: "none",
                              borderRadius: 2,
                              fontSize: 12,
                              lineHeight: 1,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {stitchError && (
        <p role="alert" style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>
          {stitchError}
        </p>
      )}

      {stitching && stitchProgress && (
        <p
          role="status"
          aria-live="polite"
          style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}
        >
          {stitchProgress}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {files.length < 12 && (
          <button
            onClick={onAddMore}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-accent)",
              fontSize: 14,
              cursor: "pointer",
              padding: 0,
              fontFamily: "var(--font-inter)",
            }}
          >
            + Add more images
          </button>
        )}
        <button
          onClick={onStitch}
          disabled={!canStitch}
          aria-disabled={!canStitch}
          aria-describedby={!canStitch ? "stitch-hint" : undefined}
          style={{
            marginLeft: "auto",
            height: 44,
            minWidth: 160,
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            fontSize: 14,
            fontWeight: 500,
            cursor: canStitch ? "pointer" : "not-allowed",
            opacity: canStitch ? 1 : 0.4,
            fontFamily: "var(--font-inter)",
          }}
        >
          {stitching ? "Stitching..." : "Stitch Images →"}
        </button>
      </div>
      {!canStitch && !stitching && (
        <p id="stitch-hint" style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
          Add at least 2 images to stitch
        </p>
      )}
    </div>
  );
}
