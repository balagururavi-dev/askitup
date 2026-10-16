"use client";

import { useState } from "react";

export function CopyIdButton({
  value,
  label = "Copy ID",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={copy}
        className={
          status === "copied" ? "btn btn-primary" : "btn btn-secondary"
        }
        aria-label={
          status === "copied" ? "Document ID copied" : "Copy document ID"
        }
      >
        {status === "copied" ? "Copied" : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {status === "copied"
          ? "Document ID copied to clipboard"
          : status === "failed"
            ? "Could not copy document ID"
            : ""}
      </span>
      {status === "copied" && (
        <p
          role="status"
          className="fade-in rounded-[var(--radius)] border border-[var(--success-border)] bg-[var(--success-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--success)]"
        >
          Document ID copied to clipboard. Save it to reopen this file later.
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          Clipboard unavailable. Select and copy the ID manually.
        </p>
      )}
    </div>
  );
}
