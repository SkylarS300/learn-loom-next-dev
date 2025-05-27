"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function DashboardRouter() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    const role = session?.user?.role;

    if (role === "TEACHER") {
      router.replace("/dashboard/teacher");
    } else if (role === "STUDENT") {
      router.replace("/dashboard/student");
    } else {
      router.replace("/auth");
    }
  }, [status, session]);

  return <p>Redirecting to dashboard...</p>;
}
