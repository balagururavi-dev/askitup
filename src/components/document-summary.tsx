import Link from "next/link";
import { CopyIdButton } from "@/components/copy-id-button";
import {
  stageLabel,
  type PublicDocument,
} from "@/lib/documents/types";

/** Manual UTC formatting so SSR and client hydration always match. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function statusClass(status: PublicDocument["status"]): string {
  if (status === "ready") return "status-pill status-ready";
  if (status === "failed") return "status-pill status-failed";
  return "status-pill status-processing";
}

export function DocumentSummary({
  document,
  showCopy = true,
}: {
  document: PublicDocument;
  showCopy?: boolean;
}) {
  return (
    <section className="border-b border-[var(--border)] pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
              Document
            </p>
            <span
              className={statusClass(document.status)}
              title={stageLabel(document.stage)}
            >
              <span className="sr-only">Status: </span>
              {stageLabel(document.stage)}
            </span>
          </div>
          <h1 className="mt-2 break-words font-display text-2xl font-semibold leading-snug tracking-tight text-[var(--ink)] sm:text-[1.75rem]">
            {document.filename}
          </h1>
        </div>
        <Link
          href="/"
          className="btn btn-ghost shrink-0 text-sm"
        >
          ← Workspace
        </Link>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-3 sm:p-3.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
          Document ID
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <code className="font-mono-id block min-w-0 break-all rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-xs leading-5 text-[var(--ink)] sm:text-[0.8125rem]">
            {document.id}
          </code>
          {showCopy && (
            <CopyIdButton
              value={document.id}
              label="Copy ID"
              className="shrink-0"
            />
          )}
        </div>
        {showCopy && (
          <p className="mt-2.5 text-xs leading-5 text-[var(--muted)]">
            Save this ID to reopen later without uploading again. On this public
            demo, anyone with the ID can ask questions about the document.
          </p>
        )}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="inline text-[var(--faint)]">Pages </dt>
          <dd className="inline font-medium text-[var(--ink)]">
            {document.totalPages}
          </dd>
        </div>
        <div>
          <dt className="inline text-[var(--faint)]">Passages </dt>
          <dd className="inline font-medium text-[var(--ink)]">
            {document.completedChunks}
            {document.chunkCount > 0 ? ` / ${document.chunkCount}` : ""}
          </dd>
        </div>
        <div>
          <dt className="inline text-[var(--faint)]">Uploaded </dt>
          <dd className="inline font-medium text-[var(--ink)]">
            {formatDate(document.createdAt)} UTC
          </dd>
        </div>
      </dl>

      {document.errorMessage && (
        <p className="alert mt-4" role="status">
          {document.errorMessage}
        </p>
      )}
    </section>
  );
}
