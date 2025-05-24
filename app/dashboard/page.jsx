"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");

    if (role === "TEACHER") {
      router.replace("/dashboard/teacher");
    } else if (role === "STUDENT") {
      router.replace("/dashboard/student");
    } else {
      router.replace("/login");
    }
  }, []);

  return null;
}
