"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <header id="navbar">
      <div className="navbar-inner">
        <a className="logo" href="/">
          <img src="/assets/images/learnloom.png" alt="LearnLoom Logo" className="logo-image" />
        </a>

        <ul className="nav-links">
          <li><Link href="/">Home</Link></li>
          <li><Link href="/library">Library</Link></li>
          <li><Link href="/readingpal">Reading Pal</Link></li>
          <li><Link href="/grammar">Study Grammar</Link></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#faq">FAQ</a></li>
          {role === "TEACHER" && <li><Link href="/dashboard/teacher">Dashboard</Link></li>}
          {role === "STUDENT" && <li><Link href="/dashboard/student">Dashboard</Link></li>}
        </ul>

        {session?.user ? (
          <button className="login-button" onClick={() => signOut({ callbackUrl: "/auth" })}>
            Logout
          </button>
        ) : (
          <a className="login-button" href="/auth">Login</a>
        )}
      </div>
    </header>
  );
}
