import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// POST /api/readingprogress
// Body: { bookIndex: number, chapterIndex: number }
// Auth: anonymous via "learnloomId" cookie
export async function POST(req) {
  try {
    const { bookIndex, chapterIndex } = await req.json();
    if (
      typeof bookIndex !== "number" ||
      typeof chapterIndex !== "number"
    ) {
      return new Response("Invalid payload", { status: 400 });
    }

    const anonId = cookies().get("learnloomId")?.value;
    if (!anonId) return new Response("Unauthorized", { status: 401 });

    await prisma.readingprogress.upsert({
      where: {
        anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex },
      },
      create: { anonId, bookIndex, chapterIndex },
      update: {}, // idempotent
    });

    return Response.json({ ok: true });
  } catch (e) {
    // Treat unique violations as success (double-clicks etc.)
    if (e.code === "P2002") return Response.json({ ok: true, duplicate: true });
    console.error("readingprogress POST error:", e);
    return new Response("Server error", { status: 500 });
  }
}

// GET /api/readingprogress
// Returns anon user's progress
export async function GET() {
  try {
    const anonId = cookies().get("learnloomId")?.value;
    if (!anonId) return new Response("Unauthorized", { status: 401 });

    const data = await prisma.readingprogress.findMany({
      where: { anonId },
      orderBy: { completedAt: "desc" },
    });
    return Response.json(data);
  } catch (e) {
    console.error("readingprogress GET error:", e);
    return new Response("Server error", { status: 500 });
  }
}
