import { NextResponse, type NextRequest } from "next/server";
import {
  applySecurityHeaders,
  isDocumentPath,
  withNoStore,
} from "@/lib/headers";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  applySecurityHeaders(response);

  if (isDocumentPath(request)) {
    withNoStore(response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
