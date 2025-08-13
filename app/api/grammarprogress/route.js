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
      createdAt: true,
    },
  });

  return Response.json(results);
}

export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  console.log("📥 Incoming grammar POST:", body); // ADD THIS

  const { concept, subTopic, score } = body;

  if (!concept || !subTopic || typeof score !== "number") {
    console.log("❌ Invalid body. concept:", concept, "subTopic:", subTopic, "score:", score);
    return new Response("Missing data", { status: 400 });
  }

  await prisma.grammarprogress.create({
    data: { anonId, concept, subTopic, score },
  });

  return new Response("Saved", { status: 200 });
}

