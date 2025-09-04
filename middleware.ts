// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
    "/", "/login", "/signup",
    "/favicon.ico", "/admin/support"
]);

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // Allow next/static, images, fonts, and API (auth endpoints must remain reachable)
    if (pathname.startsWith("/_next/") || pathname.startsWith("/assets/") || pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

    const hasSession = Boolean(req.cookies.get("learnloomId")?.value);

    // Gate protected pages
    if (!hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = search ? `?next=${encodeURIComponent(pathname + search)}` : `?next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}
