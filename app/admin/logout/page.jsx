// app/admin/logout/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

import { Suspense } from "react";
import LogoutClient from "./LogoutClient";
export default function AdminLogoutPage() {
    return <Suspense fallback={null}><LogoutClient /></Suspense>;
}
