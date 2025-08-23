import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

// GET: list your grammar attempts (most recent first)
export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await prisma.grammarprogress.findMany({
      where: { anonId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        concept: true,
        subTopic: true,
        score: true,          // Int 0..100
        numQuestions: true,   // Int?
        durationMs: true,     // Int?
        isAi: true,           // Bool?
        hintsUsed: true,      // Int?
        createdAt: true,
      },
    });


    return Response.json({ ok: true, data: results }, { headers: { "Cache-Control": "no-store" } });

  } catch (e) {
    console.error("grammarprogress GET failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// POST: record a grammar attempt
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { concept, subTopic, score, durationMs, numQuestions, isAi, hintsUsed } = body || {};
    if (!concept || !subTopic || score == null) {
      return Response.json({ ok: false, error: "Missing data" }, { status: 400 });
    }

    // Normalize score to Int 0..100 (schema is Int)
    let s = Number(score);
    if (Number.isNaN(s)) {
      return Response.json({ ok: false, error: "Invalid score" }, { status: 422 });
    }
    if (s <= 1) s = Math.round(s * 100); else s = Math.round(s); // support 0..1 or 0..100
    s = Math.max(0, Math.min(100, s));

    // Optional numeric fields
    const nq = Number.isFinite(Number(numQuestions)) ? Math.max(0, Math.round(Number(numQuestions))) : null;
    const dur = Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null;
    const ai = typeof isAi === "boolean" ? isAi : false;
    const hints = Number.isFinite(Number(hintsUsed)) ? Math.max(0, Math.round(Number(hintsUsed))) : null;

    const gp = await prisma.grammarprogress.create({
      data: {
        anonId,
        concept: String(concept),
        subTopic: String(subTopic),
        score: s,
        numQuestions: nq,
        durationMs: dur,
        isAi: ai,
        hintsUsed: hints,
      },
    });

    // Completion hook (QUIZ): mirror readingprogress behavior
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
            type: "QUIZ",
            targets: { some: { OR: [{ anonId }, { anonId: null }] } },
            category: String(concept),
            OR: [{ subtopic: null }, { subtopic: String(subTopic) }],
          },
          select: { id: true, dueDate: true },
        });
        await Promise.all(asns.map(async (a) => {
          const prev = await prisma.assignmentcompletion.findUnique({
            where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
            select: { scorePct: true, attemptCount: true },
          });
          const late = !!(a.dueDate && now > a.dueDate);
          const status = late ? "LATE" : "SUBMITTED";
          const best = Math.max(prev?.scorePct ?? 0, s);
          await prisma.assignmentcompletion.upsert({
            where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
            create: {
              anonId,
              assignmentId: a.id,
              status,
              submittedAt: now,
              isLate: late,
              scorePct: best,
              attemptCount: 1,
            },
            update: {
              status,
              submittedAt: now,
              isLate: late,
              scorePct: best,
              attemptCount: (prev?.attemptCount ?? 0) + 1,
            },
          });
        }));
      }
    } catch (hookErr) {
      // eslint-disable-next-line no-console
      console.warn("[grammarprogress] completion hook failed:", hookErr);
    }

    return Response.json({ ok: true, data: { saved: true, id: gp.id } });

  } catch (e) {
    console.error("grammarprogress POST failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
