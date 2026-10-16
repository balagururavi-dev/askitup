import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { QaWorkspace } from "@/components/qa-workspace";
import { loadPublicDocument } from "@/lib/documents/process";
import { isAppError } from "@/lib/errors/app-error";
import { parseDocumentId } from "@/lib/validation/uuid";
import type { PublicDocument } from "@/lib/documents/types";

/** Document pages always need runtime DB access. */
export const instant = false;

type PageProps = {
  params: Promise<{ documentId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Document workspace",
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default function DocumentPage({ params }: PageProps) {
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] flex-1 px-5 py-8 sm:py-10">
      <Suspense
        fallback={
          <p role="status" className="text-sm text-[var(--muted)]">
            Loading document…
          </p>
        }
      >
        <DocumentWorkspace params={params} />
      </Suspense>
    </main>
  );
}

async function DocumentWorkspace({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  await connection();

  const { documentId: rawId } = await params;
  const documentId = parseDocumentId(rawId);

  if (!documentId) {
    return (
      <ErrorPanel
        title="Invalid document ID"
        message="Document IDs must be valid UUIDs."
      />
    );
  }

  const result = await loadDocumentSafe(documentId);

  if (!result.ok) {
    return (
      <ErrorPanel title="Document unavailable" message={result.message} />
    );
  }

  return <QaWorkspace initialDocument={result.document} />;
}

async function loadDocumentSafe(
  documentId: string,
): Promise<
  { ok: true; document: PublicDocument } | { ok: false; message: string }
> {
  try {
    const document = await loadPublicDocument(documentId);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message: isAppError(error)
        ? error.message
        : "This document could not be found or you do not have access.",
    };
  }
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="panel-raised max-w-lg p-8">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
      <Link href="/" className="btn btn-primary mt-6 inline-flex">
        Return to workspace
      </Link>
    </div>
  );
}
