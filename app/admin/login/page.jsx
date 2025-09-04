// app/admin/login/page.jsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginClient />
        </Suspense>
    );
}
