// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that never require auth:
const PUBLIC_PATHS = new Set([
    "/", "/login", "/signup",
    "/favicon.ico", "/admin/support"
]);

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // Let _next, assets, and api pass through (api must be reachable for auth)
    if (pathname.startsWith("/_next/")
        || pathname.startsWith("/assets/")
        || pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    // Robust cookie detection (once, up front)
    const hasCookie = Boolean(req.cookies.get("learnloomId")?.value);
    const rawCookie = req.headers.get("cookie") || "";
    const hasSession = hasCookie || /\blearnloomId=/.test(rawCookie);

    if (PUBLIC_PATHS.has(pathname)) {
        // If already logged in and you hit /login, send you to next or dashboard
        if (pathname === "/login" && hasSession) {
            const url = req.nextUrl.clone();
            const params = new URLSearchParams(search);
            const next = params.get("next") || "/dashboard";
            url.pathname = next;
            url.search = "";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // Protect everything else
    if (!hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = search
            ? `?next=${encodeURIComponent(pathname + search)}`
            : `?next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/|assets/|api/|favicon.ico).*)"],
};

