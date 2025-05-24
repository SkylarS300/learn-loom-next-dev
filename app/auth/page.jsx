"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState("student");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      email: form.email.value,
      password: form.password.value,
    };

    if (isSignup) {
      payload.firstName = form.firstName.value;
      payload.lastName = form.lastName.value;
      payload.grade = parseInt(form.grade.value);
      payload.role = role.toUpperCase();
    }

    const endpoint = isSignup ? "/api/users" : "/api/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("userId", data.id);
      localStorage.setItem("role", data.role);

      if (data.role === "TEACHER") router.push("/dashboard/teacher");
      else router.push("/dashboard/student");
    } else {
      alert("Something went wrong. Try again.");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <h2>{isSignup ? "Create an Account" : "Welcome Back"}</h2>
        <p className="subtext">
          {isSignup
            ? "Sign up to start using LearnLoom."
            : "Log in with your NYCDOE email to continue."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" name="email" placeholder="DOE Email" required />
          <input type="password" name="password" placeholder="Password" required />

          {isSignup && (
            <>
              <input name="firstName" placeholder="First Name" required />
              <input name="lastName" placeholder="Last Name" required />
              <input
                name="grade"
                type="number"
                placeholder="Grade (e.g. 9)"
                required
              />

              <div className="role-select">
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={role === "student"}
                    onChange={() => setRole("student")}
                  />
                  Student
                </label>
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="teacher"
                    checked={role === "teacher"}
                    onChange={() => setRole("teacher")}
                  />
                  Teacher
                </label>
              </div>
            </>
          )}

          <button type="submit">{isSignup ? "Sign Up" : "Log In"}</button>
        </form>

        <p className="toggle-link">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <span role="button" onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}
