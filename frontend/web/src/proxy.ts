import { type NextRequest, NextResponse } from "next/server";

/**
 * The app's pages need a session. Without the cookie at all there's nothing to check, so send
 * them straight to sign in (and back here afterwards). With one, the page itself asks the API
 * whether it's still good (`getViewer`), and gets the path it's on from `x-realm-path`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!request.cookies.has("realm_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-realm-path", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/home",
    "/spaces/:path*",
    "/messages/:path*",
    "/feed/:path*",
    "/explore/:path*",
    "/u/:path*",
    "/p/:path*",
    "/clips/:path*",
    "/music/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/themes/store",
    "/themes/add",
    "/themes/studio",
    "/themes/:id(\\d+)",
    "/admin/:path*",
  ],
};
