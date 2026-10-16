import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return response;
}

export function withNoStore(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  return response;
}

export function isDocumentPath(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname.startsWith("/documents/") ||
    request.nextUrl.pathname.startsWith("/api/documents/")
  );
}
