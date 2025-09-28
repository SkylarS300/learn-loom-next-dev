// app/admin/login/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

import { Suspense } from "react";
import LoginClient from "./LoginClient";
export default function AdminLoginPage() {
    return <Suspense fallback={null}><LoginClient /></Suspense>;
}
