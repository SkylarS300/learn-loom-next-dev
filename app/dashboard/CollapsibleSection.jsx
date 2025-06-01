"use client";
import { useState } from "react";

export default function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        background: "#fefefe",
        border: "1px solid #ddd",
        borderRadius: "8px",
        margin: "1rem 0",
        padding: "1rem",
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: "600",
          fontSize: "1rem",
        }}
      >
        <span>{open ? "▾" : "▸"} {title}</span>
        <span style={{ fontSize: "0.85rem", color: "#666" }}>
          {open ? "Click to collapse" : "Click to expand"}
        </span>
      </div>
      {open && <div style={{ marginTop: "1rem" }}>{children}</div>}
    </section>
  );
}
