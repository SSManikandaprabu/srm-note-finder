import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewerModal({
  apiBase,
  studentToken,
  target,
  onRequireLogin,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(target?.title || "Study PDF");
  const [mode, setMode] = useState("stream");
  const [embedUrl, setEmbedUrl] = useState("");
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.15);

  const scrollContainerRef = useRef(null);
  const canvasRefs = useRef({});

  useEffect(() => {
    if (!target) return;

    let cancelled = false;
    let loadedDoc = null;

    async function loadPdf() {
      setLoading(true);
      setError("");
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);
      setEmbedUrl("");

      if (!studentToken) {
        setLoading(false);
        setError("Please sign in to view this PDF.");
        return;
      }

      const params = new URLSearchParams();
      if (target.unit) params.set("unit", String(target.unit));
      if (target.index !== undefined) params.set("index", String(target.index));
      if (target.fileId) params.set("fileId", String(target.fileId));
      if (target.kind) params.set("kind", String(target.kind));

      try {
        const metaRes = await fetch(
          `${apiBase}/api/resources/${target.resourceId}/pdf-meta?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${studentToken}`,
            },
          }
        );

        if (metaRes.status === 401 || metaRes.status === 403) {
          if (!cancelled) {
            setError("Session expired or unauthorized. Please sign in to view PDFs.");
            setLoading(false);
            onRequireLogin?.();
          }
          return;
        }

        const metaData = await metaRes.json();
        if (!metaRes.ok || !metaData.success) {
          throw new Error(metaData.message || "Unable to load PDF.");
        }

        if (cancelled) return;
        setTitle(metaData.title || target.title || "Study PDF");

        if (metaData.mode === "drive-preview" && metaData.embedUrl) {
          setMode("drive-preview");
          setEmbedUrl(metaData.embedUrl);
          setLoading(false);
          return;
        }

        setMode("stream");
        const streamRes = await fetch(
          `${apiBase}/api/resources/${target.resourceId}/pdf-stream?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${studentToken}`,
            },
          }
        );

        if (!streamRes.ok) {
          const errJson = await streamRes.json().catch(() => ({}));
          if (errJson.fallbackMode === "drive-preview" && metaData.embedUrl) {
            setMode("drive-preview");
            setEmbedUrl(metaData.embedUrl);
            setLoading(false);
            return;
          }
          throw new Error(errJson.message || "Failed to stream PDF.");
        }

        const buffer = await streamRes.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        loadedDoc = await loadingTask.promise;

        if (cancelled) {
          loadedDoc.destroy();
          return;
        }

        setPdfDoc(loadedDoc);
        setNumPages(loadedDoc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to open PDF.");
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy();
      }
    };
  }, [apiBase, studentToken, target]);

  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    let cancelled = false;

    async function renderAllPages() {
      const containerWidth = scrollContainerRef.current?.clientWidth || 800;
      const isMobile = containerWidth < 640;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (cancelled) break;
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) continue;

        const page = await pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = isMobile
          ? Math.max(0.5, ((containerWidth - 28) / baseViewport.width) * (scale / 1.15))
          : scale;
        const viewport = page.getViewport({ scale: fitScale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      }
    }

    renderAllPages();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, numPages, scale]);

  function scrollToPage(pageNum) {
    const clamped = Math.max(1, Math.min(numPages, pageNum));
    setCurrentPage(clamped);
    const canvas = canvasRefs.current[clamped];
    if (canvas) {
      canvas.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleScroll() {
    const container = scrollContainerRef.current;
    if (!container || numPages === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    let closest = 1;
    let minDist = Infinity;

    for (let i = 1; i <= numPages; i++) {
      const el = canvasRefs.current[i];
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop - 16);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }

    setCurrentPage(closest);
  }

  if (!target) return null;

  return (
    <div
      className="pdf-viewer-overlay"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(3, 7, 18, 0.88)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
    >
      <div
        className="pdf-viewer-toolbar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 16px",
          background: "#0f172a",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span style={{ fontSize: "18px" }}>📄</span>
          <strong
            style={{
              fontSize: "14px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "42vw",
            }}
          >
            {title}
          </strong>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(34, 211, 238, 0.14)",
              color: "#22d3ee",
              fontWeight: 600,
            }}
          >
            View Only
          </span>
        </div>

        {mode === "stream" && numPages > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={toolbarBtnStyle}
            >
              ‹ Prev
            </button>
            <span style={{ fontSize: "12px", color: "#cbd5e1", minWidth: "70px", textAlign: "center" }}>
              Page {currentPage} / {numPages}
            </span>
            <button
              type="button"
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              style={toolbarBtnStyle}
            >
              Next ›
            </button>

            <span style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.15)" }} />

            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
              style={toolbarBtnStyle}
              title="Zoom Out"
            >
              −
            </button>
            <span style={{ fontSize: "12px", color: "#cbd5e1", minWidth: "44px", textAlign: "center" }}>
              {Math.round((scale / 1.15) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
              style={toolbarBtnStyle}
              title="Zoom In"
            >
              +
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            ...toolbarBtnStyle,
            background: "rgba(239, 68, 68, 0.16)",
            borderColor: "rgba(239, 68, 68, 0.35)",
            color: "#fca5a5",
          }}
        >
          ✕ Close
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {loading && (
          <div style={{ marginTop: "60px", color: "#cbd5e1", fontSize: "14px" }}>
            Loading secure PDF viewer...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              marginTop: "60px",
              padding: "20px 24px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fecaca",
              maxWidth: "420px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && mode === "drive-preview" && embedUrl && (
          <div style={{ position: "relative", width: "min(1000px, 100%)", height: "100%", minHeight: "75vh" }}>
            <iframe
              src={embedUrl}
              title={title}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: "100%",
                height: "100%",
                minHeight: "75vh",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "10px",
                background: "#0b1120",
              }}
            />
            <div
              title="Pop-out disabled"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "56px",
                height: "56px",
                zIndex: 5,
                background: "transparent",
              }}
            />
          </div>
        )}

        {!loading &&
          !error &&
          mode === "stream" &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={(el) => {
                if (el) canvasRefs.current[pageNum] = el;
              }}
              style={{
                display: "block",
                maxWidth: "100%",
                borderRadius: "6px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                background: "#ffffff",
              }}
            />
          ))}
      </div>
    </div>
  );
}

const toolbarBtnStyle = {
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  cursor: "pointer",
};
