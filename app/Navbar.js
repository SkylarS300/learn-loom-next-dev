"use client";

import Link from "next/link";
import { ProgressCodeBadge } from "./ProgressCodeBadge";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <a className={styles.logoLink} href="/">
          <img src="/assets/images/learnloom.png" alt="LearnLoom Logo" className={styles.logoImage} />
        </a>

        <ul className={styles.navLinks}>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/library">Library</Link></li>
          <li><Link href="/readingpal">Reading Pal</Link></li>
          <li><Link href="/grammar">Study Grammar</Link></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><Link href="/dashboard">Dashboard</Link></li>
        </ul>

        <ProgressCodeBadge />
      </div>
    </header>
  );
}
