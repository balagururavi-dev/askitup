import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config/public";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <span className="font-display text-xl font-semibold tracking-tight text-[var(--ink)]">
            {SITE_NAME}
          </span>
          <span className="mt-0.5 hidden text-xs text-[var(--muted)] sm:block">
            {SITE_TAGLINE}
          </span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
