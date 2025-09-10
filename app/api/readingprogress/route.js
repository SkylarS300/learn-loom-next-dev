import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tunable guard to reduce “instant completions”
const MIN_CHAPTER_TIME_MS = 45_000; // 45s; conservative and user-friendly

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
  } = body ?? {};
  if (!Number.isInteger(bookIndex) || !Number.isInteger(chapterIndex)) {
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

  // Cap single-slice time to 60s to avoid background/sleep runaway
  const dt = Math.min(60_000, Math.max(0, Number(deltaTimeMs) || 0));

  // First attempt: with sentenceIndex/timeMs (new schema)
  try {
    const row = await prisma.readingprogress.upsert({
      where: { anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex } },
      create: {
        anonId,
        bookIndex,
        chapterIndex,
        sentenceIndex,
        timeMs: dt, // start the counter
      },
      update: {
        sentenceIndex: sentenceIndex === null ? undefined : sentenceIndex,
        timeMs: dt ? { increment: dt } : undefined,
        // if chapterCompleted, bump completedAt to "now" (lets you see latest completion)
        ...(chapterCompleted ? { completedAt: new Date() } : {}),
      },
    });

    // Completion hook (BOOK) — fire only when:
    //  A) the client signals chapterCompleted === true, AND
    //  B) cumulative time on this chapter meets a small minimum threshold
    const meetsTime = (row?.timeMs || 0) >= MIN_CHAPTER_TIME_MS;
    if (!chapterCompleted || !meetsTime) {
      return NextResponse.json({ ok: true, data: row });
    }

    // If we pass both checks, sync completions for any targeted BOOK assignments.
    try {
      const memberships = await prisma.studentclassroom.findMany({
        where: { anonId, role: { not: "teacher" } },
        select: { classroomId: true },
      });
      const classIds = memberships.map((m) => m.classroomId);
      if (classIds.length) {
        const now = new Date();
        const asns = await prisma.assignment.findMany({
          where: {
            classroomId: { in: classIds },
            type: "BOOK",
            targets: { some: { OR: [{ anonId }, { anonId: null }] } },
            AND: [
              { OR: [{ bookId: null }, { bookId: Number(bookIndex) }] },
              { OR: [{ chapterIndex: null }, { chapterIndex: Number(chapterIndex) }] },
            ],
          },
          select: { id: true, dueDate: true },
        });
        await Promise.all(
          asns.map(async (a) => {
            const prev = await prisma.assignmentcompletion.findUnique({
              where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
              select: { attemptCount: true },
            });
            const late = !!(a.dueDate && now > a.dueDate);
            const status = late ? "LATE" : "SUBMITTED";
            await prisma.assignmentcompletion.upsert({
              where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
              create: {
                anonId,
                assignmentId: a.id,
                status,
                submittedAt: now,
                isLate: late,
                attemptCount: 1,
              },
              update: {
                status,
                submittedAt: now,
                isLate: late,
                attemptCount: (prev?.attemptCount ?? 0) + 1,
              },
            });
          })
        );
      }
    } catch (hookErr) {
      // eslint-disable-next-line no-console
      console.warn("[readingprogress] completion hook failed:", hookErr);
    }
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

      // legacy branch: still run completion hook,
      // but require explicit chapterCompleted (no timeMs column here)
      if (!chapterCompleted) {
        return NextResponse.json({ ok: true, data: row, note: "legacy-progress" });
      }
      try {
        const memberships = await prisma.studentclassroom.findMany({
          where: { anonId, role: { not: "teacher" } },
          select: { classroomId: true },
        });
        const classIds = memberships.map((m) => m.classroomId);
        if (classIds.length) {
          const now = new Date();
          const asns = await prisma.assignment.findMany({
            where: {
              classroomId: { in: classIds },
              type: "BOOK",
              targets: { some: { OR: [{ anonId }, { anonId: null }] } },
              AND: [
                { OR: [{ bookId: null }, { bookId: Number(bookIndex) }] },
                { OR: [{ chapterIndex: null }, { chapterIndex: Number(chapterIndex) }] },
              ],
            },
            select: { id: true, dueDate: true },
          });
          await Promise.all(
            asns.map(async (a) => {
              const prev = await prisma.assignmentcompletion.findUnique({
                where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
                select: { attemptCount: true },
              });
              const late = !!(a.dueDate && now > a.dueDate);
              const status = late ? "LATE" : "SUBMITTED";
              await prisma.assignmentcompletion.upsert({
                where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
                create: {
                  anonId,
                  assignmentId: a.id,
                  status,
                  submittedAt: now,
                  isLate: late,
                  attemptCount: 1,
                },
                update: {
                  status,
                  submittedAt: now,
                  isLate: late,
                  attemptCount: (prev?.attemptCount ?? 0) + 1,
                },
              });
            })
          );
        }
      } catch (hookErr) {
        // eslint-disable-next-line no-console
        console.warn("[readingprogress] completion hook failed (legacy):", hookErr);
      }
      // Return legacy row so client keeps working (won't have new fields)
      return NextResponse.json({ ok: true, data: row, note: "legacy-progress" });
    } catch (e2) {
      console.error("[readingprogress] legacy upsert failed:", e2);
      return NextResponse.json({ ok: false, error: "Failed to save reading progress" }, { status: 500 });
    }
  }
}
