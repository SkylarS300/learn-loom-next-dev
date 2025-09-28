// app/admin/support/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

import { Suspense } from "react";
import SupportClient from "./SupportClient";

export default function AdminSupportPage() {
    return (
        <Suspense fallback={null}>
            <SupportClient />
        </Suspense>
    );
}
