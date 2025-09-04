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
    // Single, robust session check
    const hasCookie = Boolean(req.cookies.get("learnloomId")?.value);
    const rawCookie = req.headers.get("cookie") || "";
    const hasSession = hasCookie || /\blearnloomId=/.test(rawCookie);



    if (PUBLIC_PATHS.has(pathname)) {
        // If already logged in and you hit /login, just go to /dashboard
        if (pathname === "/login" && hasSession) {
            const url = req.nextUrl.clone();
            url.pathname = "/dashboard";
            url.search = "";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // Protect everything else (always send to plain /login)
    if (!hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/|assets/|api/|favicon.ico).*)"],
};

