"use client";

import { useState } from "react";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <h2>{isSignup ? "Create an Account" : "Welcome Back"}</h2>
        <p className="subtext">
          {isSignup ? "Sign up to start using LearnLoom." : "Log in to continue your progress."}
        </p>

        <form className="auth-form">
          <input type="email" placeholder="Email" required />
          <input type="password" placeholder="Password" required />
          {isSignup && <input type="password" placeholder="Confirm Password" required />}

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
