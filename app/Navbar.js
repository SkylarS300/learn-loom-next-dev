"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [me, setMe] = useState({ anonId: null, shortCode: null, loading: true });

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/session/me", { cache: "no-store" });
        const j = await r.json();
        if (!dead) {
          setMe({
            anonId: j?.data?.anonId || null,
            shortCode: j?.data?.shortCode || null,
            loading: false,
          });
        }
      } catch {
        if (!dead) setMe({ anonId: null, shortCode: null, loading: false });
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const loggedIn = !!me.anonId;

  async function copyCode() {
    try {
      if (!loggedIn) {
        window.location.href = "/signup"; // user explicitly opts in to create a code
        return;
      }
      if (!me.shortCode) {
        // No minting here—direct them to generate via Signup / Dashboard flow
        toast("No code yet. Visit Signup to create one.");
        return;
      }
      await navigator.clipboard.writeText(me.shortCode);
      toast("Code copied");
    } catch {
      /* no-op */
    }
  }

  async function logout() {
    try {
      await fetch("/api/session/logout", { method: "POST" });
    } catch { }
    try {
      localStorage.clear();
    } catch { }
    // clear cookie client-side (server already cleared; this avoids stale UI)
    document.cookie = "learnloomId=; Max-Age=0; path=/";
    window.location.href = "/login";
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <a className={styles.logoLink} href="/">
          <img
            src="/assets/images/learnloom.png"
            alt="LearnLoom Logo"
            className={styles.logoImage}
          />
        </a>

        <ul className={styles.navLinks}>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/library">Library</Link>
          </li>
          <li>
            <Link href="/readingpal">Reading Pal</Link>
          </li>
          <li>
            <Link href="/grammar">Study Grammar</Link>
          </li>
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
        </ul>

        <div
          className={styles.actions}
          style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}
        >
          {loggedIn ? (
            <>
              <button onClick={copyCode} className={styles.btnSecondary} style={btnSecondary}>
                Copy code
              </button>
              <button onClick={logout} className={styles.btnDanger} style={btnDanger}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.btnSecondary} style={btnSecondary}>
                Log in
              </Link>
              <Link href="/signup" className={styles.btnPrimary} style={btnPrimary}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111827",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    zIndex: 9999,
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

const btnPrimary = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  cursor: "pointer",
};
const btnSecondary = {
  background: "#e9eefc",
  color: "#0b3b9f",
  border: "1px solid #c9d7fb",
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  cursor: "pointer",
};
const btnDanger = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};
