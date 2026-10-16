import {
  PUBLIC_LIMITS,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/config/public";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid w-full max-w-[var(--page-max)] gap-8 px-5 py-10 sm:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="font-display text-lg font-semibold text-[var(--ink)]">
            {SITE_NAME}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            {SITE_TAGLINE} Upload a PDF once, keep a document ID, and ask
            grounded questions with page citations whenever you return.
          </p>
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            Notes
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>
              This is a limited proof-of-concept demo—please try small PDFs
              (under {PUBLIC_LIMITS.maxPdfLabel}, {PUBLIC_LIMITS.maxPages}{" "}
              pages or fewer). Large or heavy files may time out or fail.
            </li>
            <li>Original PDFs are not kept after processing.</li>
            <li>Document IDs are references, not private keys on this demo.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-[var(--page-max)] flex-col gap-2 px-5 py-5 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built by{" "}
            <a
              href="https://www.balagururavi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent-deep)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Balaguru Ravi
            </a>
          </p>
          <p className="text-xs sm:text-sm">© 2026 {SITE_NAME}</p>
        </div>
      </div>
    </footer>
  );
}
