// /app/api/grammarprogress/route.js
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const results = await prisma.grammarprogress.findMany({
    where: { anonId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      concept: true,
      subTopic: true,
      score: true,
      numQuestions: true,
      durationMs: true,
      createdAt: true,
    },
  });

  return Response.json(results);
}

export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  console.log("📥 Incoming grammar POST:", body);

  let { concept, subTopic, score, numQuestions, durationMs } = body ?? {}; if (!concept || !subTopic || (typeof score !== "number" && typeof score !== "string")) {
    console.log("❌ Invalid body. concept:", concept, "subTopic:", subTopic, "score:", score);
    return new Response("Missing data", { status: 400 });
  }

  // Normalize score to Int 0..100 (schema is Int)
  score = Number(score);
  if (Number.isNaN(score)) return new Response("Invalid score", { status: 422 });
  if (score <= 1) score = Math.round(score * 100);   // treat 0..1 as fraction
  else score = Math.round(score);                     // already 0..100
  score = Math.max(0, Math.min(100, score));

  // Optional metadata (sanitize)
  const nq = Number.isFinite(Number(numQuestions)) ? Math.max(0, Math.round(Number(numQuestions))) : null;
  const dur = Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null;


  try {
    await prisma.grammarprogress.create({
      data: {
        anonId,
        concept: String(concept),
        subTopic: String(subTopic),
        score,
        numQuestions: nq,
        durationMs: dur,
      },
    });
    return new Response("Saved", { status: 200 });
  } catch (e) {
    console.error("grammarprogress create failed:", e);
    return new Response("Server error", { status: 500 });
  }
}

