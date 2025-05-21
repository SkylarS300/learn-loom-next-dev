"use client";

import { useState } from "react";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState("student");

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <h2>{isSignup ? "Create an Account" : "Welcome Back"}</h2>
        <p className="subtext">
          {isSignup
            ? "Sign up to start using LearnLoom."
            : "Log in with your NYCDOE email to continue."}
        </p>

        <form className="auth-form">
          <input type="email" placeholder="Sign in with your NYCDOE Google email" required />
          <input type="password" placeholder="Password" required />
          {isSignup && (
            <>
              <input type="password" placeholder="Confirm Password" required />
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

          <p className="google-info">
            🔒 Google Sign-In with NYCDOE accounts will be required soon.
          </p>
          <button type="submit">{isSignup ? "Sign Up" : "Log In"}</button>
        </form>

        <p className="toggle-link">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <span onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}
