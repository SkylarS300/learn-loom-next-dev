import { prisma } from "@/lib/prisma";
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
    return Response.json({ ok: true, data: results });
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

    const body = await req.json();
    const { concept, subTopic, score, durationMs, numQuestions, isAi, hintsUsed } = body || {}; if (!concept || !subTopic || score == null) {
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

    await prisma.grammarprogress.create({
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

    return Response.json({ ok: true, data: { saved: true } });
  } catch (e) {
    console.error("grammarprogress POST failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
