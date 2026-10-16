"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        className="h-8 w-[10.5rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
        aria-hidden
      />
    );
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            className={
              selected
                ? "rounded-[calc(var(--radius-md)-2px)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] shadow-[var(--shadow-sm)]"
                : "rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            }
          >
            {option.value === "system" ? "Auto" : option.label}
          </button>
        );
      })}
    </div>
  );
}
