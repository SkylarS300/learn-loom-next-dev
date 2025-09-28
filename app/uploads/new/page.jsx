// app/uploads/new/page.jsx
// (NO "use client" here)

export const dynamic = "force-dynamic"; // don't prerender this route
export const revalidate = 0;            // no caching

import NewUploadClient from "./NewUploadClient";

export default function NewUploadPage() {
  return <NewUploadClient />;
}
