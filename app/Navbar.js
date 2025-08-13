"use client";
import Link from "next/link";

export default function Navbar() {
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
          <li><Link href="/uploads">Uploads</Link></li>
          <li><Link href="/dashboard">Dashboard</Link></li>
        </ul>
      </div>
    </header>
  );
}
