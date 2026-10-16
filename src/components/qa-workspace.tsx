"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DocumentSummary } from "@/components/document-summary";
import { PUBLIC_LIMITS } from "@/lib/config/public";
import type { PublicDocument } from "@/lib/documents/types";

type Citation = {
  chunkKey: string;
  pageNumber: number;
  excerpt?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const EXAMPLE_QUESTIONS = [
  "What is the main topic of this document?",
  "Summarize the key findings.",
  "What dates or deadlines are mentioned?",
];

export function QaWorkspace({
  initialDocument,
}: {
  initialDocument: PublicDocument;
}) {
  return (
    <QaWorkspaceInner key={initialDocument.id} initialDocument={initialDocument} />
  );
}

function QaWorkspaceInner({
  initialDocument,
}: {
  initialDocument: PublicDocument;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<{
    messageIndex: number;
    citation: Citation;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composerId = useId();
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (messages.length === 0 && !asking) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking]);

  async function retryProcessing() {
    if (retrying) return;
    setRetrying(true);
    setError("");
    setStatusMessage("Retrying document processing…");

    try {
      const response = await fetch(`/api/documents/${document.id}/retry`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Retry failed.");
      }
      setDocument(result.document);
      setStatusMessage("Document is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
      setStatusMessage("");
    } finally {
      setRetrying(false);
    }
  }

  async function askQuestion(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking || document.status !== "ready") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setSelectedEvidence(null);
    setQuestion("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmed },
    ]);
    setAsking(true);
    setStatusMessage("Retrieving relevant passages…");

    try {
      const response = await fetch("/api/documents/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          question: trimmed,
        }),
        signal: controller.signal,
      });

      setStatusMessage("Writing an answer from the evidence…");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Question failed.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        },
      ]);
      setStatusMessage("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Question failed.");
      setQuestion(trimmed);
      setStatusMessage("");
    } finally {
      setAsking(false);
    }
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askQuestion();
    }
  }

  const ready = document.status === "ready";
  const remaining =
    PUBLIC_LIMITS.maxQuestionLength - question.length;

  return (
    <div className="flex flex-col gap-6">
      <DocumentSummary document={document} />

      {document.status === "failed" && document.retryable && (
        <div className="alert fade-in" role="alert">
          <p>
            Processing did not finish. Successfully stored passages were kept.
            You can resume from where it stopped.
          </p>
          <button
            type="button"
            onClick={retryProcessing}
            disabled={retrying}
            className="btn btn-danger mt-3"
          >
            {retrying ? "Retrying…" : "Retry processing"}
          </button>
        </div>
      )}

      {!ready && document.status !== "failed" && (
        <div className="alert alert-warning" role="status">
          This document is still processing. Questions unlock when status is
          Ready.
          {statusMessage ? ` ${statusMessage}` : null}
        </div>
      )}

      <section
        aria-labelledby={`${composerId}-heading`}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="mb-4">
          <h2
            id={`${composerId}-heading`}
            className="font-display text-xl font-semibold text-[var(--ink)]"
          >
            Ask this document
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Answers use retrieved passages only. Citations open the source
            excerpt—there is no PDF viewer in this demo.
          </p>
        </div>

        <div
          aria-live="polite"
          className="flex flex-col gap-5"
        >
          {!messages.length && !asking && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/60 px-5 py-8">
              <p className="text-sm leading-6 text-[var(--muted)]">
                {ready
                  ? "Ask a specific question, or start with one of these:"
                  : "Wait for processing to finish before asking questions."}
              </p>
              {ready && (
                <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {EXAMPLE_QUESTIONS.map((example) => (
                    <li key={example}>
                      <button
                        type="button"
                        onClick={() => setQuestion(example)}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] sm:w-auto"
                      >
                        {example}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className="fade-in"
            >
              {message.role === "user" ? (
                <div className="ml-0 border-l-2 border-[var(--accent)] pl-4 sm:ml-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                    You asked
                  </p>
                  <p className="mt-1 max-w-[var(--measure)] whitespace-pre-wrap text-[0.975rem] leading-7 text-[var(--ink)]">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div className="max-w-[calc(var(--measure)+2rem)]">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                    Answer
                  </p>
                  <div className="mt-2 whitespace-pre-wrap font-display text-[1.05rem] leading-[1.7] text-[var(--ink)]">
                    {message.content}
                  </div>

                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-5 border-t border-[var(--border)] pt-4">
                      <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
                        Sources in your document
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="Page citations"
                      >
                        {message.citations.map((citation) => {
                          const selected =
                            selectedEvidence?.messageIndex === index &&
                            selectedEvidence.citation.chunkKey ===
                              citation.chunkKey;
                          return (
                            <button
                              key={citation.chunkKey}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setSelectedEvidence(
                                  selected
                                    ? null
                                    : { messageIndex: index, citation },
                                )
                              }
                              className={
                                selected
                                  ? "rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-deep)]"
                                  : "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                              }
                            >
                              Page {citation.pageNumber}
                            </button>
                          );
                        })}
                      </div>

                      {selectedEvidence?.messageIndex === index &&
                        selectedEvidence.citation.excerpt && (
                          <aside
                            className="fade-in mt-4 rounded-[var(--radius-md)] border border-[var(--evidence-border)] bg-[var(--evidence)] p-4"
                            aria-live="polite"
                          >
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--evidence-mark)]">
                              Evidence · page{" "}
                              {selectedEvidence.citation.pageNumber}
                            </p>
                            <blockquote className="mt-2 border-l-2 border-[var(--evidence-mark)] pl-3 text-sm leading-6 text-[var(--ink)]">
                              {selectedEvidence.citation.excerpt}
                            </blockquote>
                          </aside>
                        )}

                      {selectedEvidence?.messageIndex === index &&
                        !selectedEvidence.citation.excerpt && (
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            Referenced page{" "}
                            {selectedEvidence.citation.pageNumber}. Excerpt text
                            is unavailable for this citation.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}

          {asking && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[var(--muted)]"
            >
              <span className="loading-dots text-[var(--accent)]" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {statusMessage || "Working…"}
            </p>
          )}

          <div ref={threadEndRef} />
        </div>

        <form
          onSubmit={askQuestion}
          className="sticky bottom-0 mt-8 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] pt-4 backdrop-blur-sm"
        >
          <label htmlFor={composerId} className="sr-only">
            Ask a question about your PDF
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              id={composerId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={
                ready
                  ? "Ask something about this document…"
                  : "Document not ready yet…"
              }
              disabled={!ready || asking}
              maxLength={PUBLIC_LIMITS.maxQuestionLength}
              rows={2}
              className="field min-h-[3.25rem] min-w-0 flex-1 resize-y"
            />
            <button
              type="submit"
              disabled={!ready || !question.trim() || asking}
              className="btn btn-primary sm:min-w-[5.5rem]"
            >
              {asking ? "Asking…" : "Ask"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
            <p>
              Enter to send · Shift+Enter for a new line. Verify important
              answers against cited pages.
            </p>
            <p aria-live="polite" className="tabular-nums">
              {remaining} left
            </p>
          </div>
        </form>
      </section>

      {error && (
        <div role="alert" className="alert fade-in">
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {question.trim() && ready && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void askQuestion()}
                disabled={asking}
              >
                Try again
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setError("")}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
