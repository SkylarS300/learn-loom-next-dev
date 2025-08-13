"use client";
import { SessionProvider } from "next-auth/react";

export default function SessionBoundary({ children }) {
    // If the root already has a SessionProvider, nesting is safe.
    return <SessionProvider>{children}</SessionProvider>;
}
