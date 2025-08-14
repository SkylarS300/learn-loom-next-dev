import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const {
    bookIndex,
    chapterIndex,
    sentenceIndex = null,
    deltaTimeMs = 0,
    chapterCompleted = false,
  } = body ?? {}; if (!Number.isInteger(bookIndex) || !Number.isInteger(chapterIndex)) {
    return NextResponse.json(
      { ok: false, error: "bookIndex and chapterIndex must be integers" },
      { status: 422 }
    );
  }
  if (sentenceIndex !== null && !Number.isInteger(sentenceIndex)) {
    return NextResponse.json(
      { ok: false, error: "sentenceIndex must be an integer or null" },
      { status: 422 }
    );
  }
  if (!Number.isInteger(deltaTimeMs) || deltaTimeMs < 0) {
    return NextResponse.json(
      { ok: false, error: "deltaTimeMs must be a nonnegative integer" },
      { status: 422 }
    );
  }

  const c = await cookies();
  const anonId = c.get("learnloomId")?.value;
  if (!anonId) {
    return NextResponse.json(
      { ok: false, error: "Missing anonymous ID (learnloomId)" },
      { status: 401 }
    );
  }

  // First attempt: with sentenceIndex/timeMs (new schema)
  try {
    const row = await prisma.readingprogress.upsert({
      where: { anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex } },
      create: {
        anonId,
        bookIndex,
        chapterIndex,
        sentenceIndex,
        timeMs: deltaTimeMs || 0,
      },
      update: {
        sentenceIndex: sentenceIndex === null ? undefined : sentenceIndex,
        timeMs: deltaTimeMs ? { increment: deltaTimeMs } : undefined,
        // if chapterCompleted, bump completedAt to "now" (lets you see latest completion)
        ...(chapterCompleted ? { completedAt: new Date() } : {}),
      },
    });
    return NextResponse.json({ ok: true, data: row });
  } catch (e) {
    // If columns don't exist yet, fall back to legacy shape (no new fields)
    const msg = (e && (e.message || String(e))) || "";
    const looksLikeLegacy = /Unknown\s+arg|Unknown\s+field|Column.*doesn'?t exist/i.test(msg);
    if (!looksLikeLegacy) {
      console.error("[readingprogress] upsert failed:", e);
      return NextResponse.json({ ok: false, error: "Failed to save reading progress" }, { status: 500 });
    }
    try {
      const row = await prisma.readingprogress.upsert({
        where: { anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex } },
        create: { anonId, bookIndex, chapterIndex },
        update: chapterCompleted ? { completedAt: new Date() } : {}, // legacy-safe
      });
      // Return legacy row so client keeps working (won't have new fields)
      return NextResponse.json({ ok: true, data: row, note: "legacy-progress" });
    } catch (e2) {
      console.error("[readingprogress] legacy upsert failed:", e2);
      return NextResponse.json({ ok: false, error: "Failed to save reading progress" }, { status: 500 });
    }
  }
}
