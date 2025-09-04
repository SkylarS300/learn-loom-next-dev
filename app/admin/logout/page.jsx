// app/admin/logout/page.jsx
import { Suspense } from "react";
import LogoutClient from "./LogoutClient";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLogoutPage() {
    return (
        <Suspense fallback={null}>
            <LogoutClient />
        </Suspense>
    );
}
