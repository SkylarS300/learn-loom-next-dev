"use client";

import { usePathname, useSearchParams } from "next/navigation";

export default function NavbarGuard({ children }) {
    const pathname = usePathname();
    const sp = useSearchParams();

    // Routes where we intentionally hide the navbar (fullscreen-style views)
    const hideOn = new Set([
        "/readingpal/fullscreen",
        "/uploads/reader/fullscreen",
    ]);

    // Also hide if a page is opened with ?fullscreen=1
    const isFullscreen = sp.get("fullscreen") === "1";

    const shouldHide =
        isFullscreen ||
        hideOn.has(pathname);

    if (shouldHide) return null;

    return children ?? null;
}
