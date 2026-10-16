"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { PUBLIC_LIMITS } from "@/lib/config/public";
import { parseDocumentId } from "@/lib/validation/uuid";
import type { PublicDocument } from "@/lib/documents/types";

const PROCESS_STAGES = [
  { key: "upload", label: "Upload & validate" },
  { key: "extract", label: "Extract text" },
  { key: "chunk", label: "Create chunks" },
  { key: "embed", label: "Generate embeddings" },
  { key: "store", label: "Save document" },
] as const;

type ProcessStageKey = (typeof PROCESS_STAGES)[number]["key"];

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

export function HomeWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropId = useId();
  const continueId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rejectHint, setRejectHint] = useState("");
  const [documentIdInput, setDocumentIdInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [activeStage, setActiveStage] = useState<ProcessStageKey | null>(null);
  const [stageNote, setStageNote] = useState("");
  const [error, setError] = useState("");
  const [continueError, setContinueError] = useState("");
  const [document, setDocument] = useState<PublicDocument | null>(null);

  function selectFile(next: File | null) {
    setRejectHint("");
    setError("");
    setDocument(null);
    setActiveStage(null);
    setStageNote("");

    if (!next) {
      setFile(null);
      return;
    }

    if (!isPdfFile(next)) {
      setFile(null);
      setRejectHint("Only PDF files are accepted.");
      return;
    }

    if (next.size > PUBLIC_LIMITS.maxPdfBytes) {
      setFile(null);
      setRejectHint(`File exceeds the ${PUBLIC_LIMITS.maxPdfLabel} limit.`);
      return;
    }

    setFile(next);
  }

  async function uploadPdf() {
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    setDocument(null);
    setActiveStage("upload");
    setStageNote("Uploading and validating your PDF…");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setActiveStage("extract");
      setStageNote("Extracting text, chunking, and embedding…");

      const stageTimer = window.setTimeout(() => {
        setActiveStage("chunk");
      }, 1200);
      const embedTimer = window.setTimeout(() => {
        setActiveStage("embed");
      }, 2800);
      const storeTimer = window.setTimeout(() => {
        setActiveStage("store");
        setStageNote("Saving document and preparing your workspace…");
      }, 4800);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      window.clearTimeout(stageTimer);
      window.clearTimeout(embedTimer);
      window.clearTimeout(storeTimer);

      const result = await response.json();

      if (!response.ok) {
        if (result.document) {
          setDocument(result.document);
        }
        throw new Error(result.error ?? "Upload failed.");
      }

      setDocument(result.document);
      setActiveStage("store");
      setStageNote("Processing completed. Opening workspace…");
      router.push(`/documents/${result.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setActiveStage(null);
      setStageNote("");
    } finally {
      setUploading(false);
    }
  }

  async function openExisting(event: React.FormEvent) {
    event.preventDefault();
    if (opening) return;

    const parsed = parseDocumentId(documentIdInput.trim());
    if (!parsed) {
      setContinueError("Enter a valid document ID (UUID).");
      return;
    }

    setOpening(true);
    setContinueError("");
    setStageNote("Looking up document…");

    try {
      const response = await fetch(`/api/documents/${parsed}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Document not found.");
      }

      setDocument(result.document);
      router.push(`/documents/${parsed}`);
    } catch (err) {
      setContinueError(
        err instanceof Error
          ? err.message
          : "This document could not be found or you do not have access.",
      );
      setStageNote("");
    } finally {
      setOpening(false);
    }
  }

  const stageIndex = activeStage
    ? PROCESS_STAGES.findIndex((s) => s.key === activeStage)
    : -1;

  return (
    <div className="space-y-14">
      {/* Brand intro — product first, not a marketing hero stack */}
      <header className="max-w-2xl pt-2">
        <p className="intro-eyebrow text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
          Document intelligence
        </p>
        <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-[var(--ink)] sm:text-5xl">
          Ask your documents.
          <span className="mt-1 block text-[var(--muted)]">
            Find the answers.
          </span>
        </h1>
        <div
          className="intro-rule mt-5 h-px w-24 bg-[var(--accent)]"
          aria-hidden
        />
        <p className="intro-secondary mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">
          Import a PDF once. Keep a durable document ID. Ask grounded questions
          and read answers with page citations—without re-uploading.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] lg:items-start lg:gap-12">
        {/* Primary: new document */}
        <section
          id="start"
          className="intro-panel panel-raised scroll-mt-24 p-5 sm:p-7"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Start with a new document
            </h2>
            <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--faint)] sm:inline">
              Primary
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Text-based PDFs only · up to {PUBLIC_LIMITS.maxPdfLabel} ·{" "}
            {PUBLIC_LIMITS.maxPages} pages ·{" "}
            {PUBLIC_LIMITS.maxChunksPerDocument} chunks max
          </p>

          <div
            id={dropId}
            role="button"
            tabIndex={0}
            aria-label="PDF drop zone. Press Enter to browse files."
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (
                event.currentTarget.contains(event.relatedTarget as Node | null)
              ) {
                return;
              }
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const dropped = event.dataTransfer.files?.[0] ?? null;
              selectFile(dropped);
            }}
            className={
              dragging
                ? "mt-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-10 text-center transition-colors"
                : "mt-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-5 py-10 text-center transition-colors"
            }
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(event) =>
                selectFile(event.target.files?.[0] ?? null)
              }
            />
            <p className="break-words text-base font-medium text-[var(--ink)]">
              {file?.name ?? "Drop a PDF here"}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB selected`
                : "or browse your files to begin processing"}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn btn-secondary"
              >
                Browse PDF
              </button>
              <button
                type="button"
                onClick={uploadPdf}
                disabled={!file || uploading}
                className="btn btn-primary"
              >
                {uploading ? "Processing…" : "Upload & process"}
              </button>
            </div>
          </div>

          {rejectHint && (
            <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
              {rejectHint}
            </p>
          )}

          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
            We extract the text, split it into passages, embed them, and store
            the result under a document ID you can reopen later. The original
            file is not retained after processing.
          </p>

          {(uploading || activeStage) && (
            <div
              className="fade-in mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
              aria-live="polite"
            >
              <p role="status" className="text-sm font-medium text-[var(--ink)]">
                {stageNote || "Working…"}
              </p>
              <ol className="mt-4 space-y-2">
                {PROCESS_STAGES.map((stage, index) => {
                  const done = stageIndex > index;
                  const current = stageIndex === index;
                  return (
                    <li
                      key={stage.key}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        aria-hidden
                        className={
                          done
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"
                            : current
                              ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[0.65rem] font-bold text-[var(--accent-deep)]"
                              : "flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[0.65rem] text-[var(--faint)]"
                        }
                      >
                        {done ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M1.5 5.2 3.8 7.5 8.5 2.5"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={
                          current
                            ? "font-medium text-[var(--ink)]"
                            : done
                              ? "text-[var(--muted)]"
                              : "text-[var(--faint)]"
                        }
                      >
                        {stage.label}
                        {current && (
                          <span className="loading-dots ml-2 text-[var(--accent)]">
                            <span />
                            <span />
                            <span />
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <div aria-live="polite" className="mt-4 space-y-3">
            {document && !error && (
              <p className="text-sm text-[var(--muted)]">
                Loaded {document.filename} ({document.status}).
              </p>
            )}
            {error && (
              <div role="alert" className="alert">
                <p>{error}</p>
                {document?.retryable && (
                  <button
                    type="button"
                    className="btn btn-secondary mt-3"
                    onClick={() =>
                      router.push(`/documents/${document.id}`)
                    }
                  >
                    Open document to retry
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Secondary: continue */}
        <aside className="intro-panel intro-panel-delay space-y-6 lg:pt-1">
          <section
            id="continue"
            className="panel scroll-mt-24 p-5 sm:p-6"
          >
            <h2 className="font-display text-xl font-semibold text-[var(--ink)]">
              Continue with an existing document
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Paste a saved document ID. Stored passages load immediately—no
              re-upload or re-embedding.
            </p>

            <form onSubmit={openExisting} className="mt-5">
              <label
                htmlFor={continueId}
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Document ID
              </label>
              <input
                id={continueId}
                value={documentIdInput}
                onChange={(event) => {
                  setDocumentIdInput(event.target.value);
                  if (continueError) setContinueError("");
                }}
                onPaste={(event) => {
                  const pasted = event.clipboardData
                    .getData("text")
                    .trim();
                  if (parseDocumentId(pasted)) {
                    event.preventDefault();
                    setDocumentIdInput(pasted);
                    setContinueError("");
                  }
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="field field-mono mt-2"
                aria-invalid={Boolean(continueError)}
                aria-describedby={
                  continueError ? `${continueId}-error` : undefined
                }
              />
              <button
                type="submit"
                disabled={opening || !documentIdInput.trim()}
                className="btn btn-primary mt-4 w-full sm:w-auto"
              >
                {opening ? "Opening…" : "Open document"}
              </button>
            </form>

            <div aria-live="polite" className="mt-3">
              {opening && stageNote && (
                <p role="status" className="text-sm text-[var(--muted)]">
                  {stageNote}
                </p>
              )}
              {continueError && (
                <p
                  id={`${continueId}-error`}
                  role="alert"
                  className="alert mt-3"
                >
                  {continueError}
                </p>
              )}
            </div>
          </section>

          <div className="border-t border-[var(--border)] pt-5 text-sm leading-6 text-[var(--muted)]">
            <p>
              <span className="font-semibold text-[var(--ink)]">Privacy.</span>{" "}
              This deployment is an anonymous public demo. A document ID is a
              reference, not authentication—anyone with the ID can ask about
              that document. Shared storage is capped at{" "}
              {PUBLIC_LIMITS.maxStoredChunksGlobal} chunks.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
