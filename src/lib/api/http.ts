import { NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors/app-error";

export function jsonOk<T extends Record<string, unknown>>(
  body: T,
  init?: ResponseInit,
) {
  return NextResponse.json(body, init);
}

export function jsonError(error: unknown) {
  const { status, body } = toPublicError(error);
  return NextResponse.json(body, { status });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
