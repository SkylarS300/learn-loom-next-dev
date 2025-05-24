"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  function handleLogin(role) {
    const fakeUserId = role === "TEACHER" ? 1 : 2; // replace with real ID logic later
    localStorage.setItem("role", role);
    localStorage.setItem("userId", fakeUserId.toString());
    router.push("/dashboard");
  }


  return (
    <div style={{ padding: "60px", textAlign: "center" }}>
      <h1>Login (TEMP PAGE)</h1>
      <p>This is a placeholder. Select a role to simulate login:</p>
      <button onClick={() => handleLogin("TEACHER")} style={{ margin: "10px" }}>Log in as Teacher</button>
      <button onClick={() => handleLogin("STUDENT")}>Log in as Student</button>
    </div>
  );
}
