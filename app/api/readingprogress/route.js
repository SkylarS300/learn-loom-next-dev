import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { bookIndex, chapterIndex } = await request.json();
  if (typeof bookIndex !== "number" || typeof chapterIndex !== "number") {
    return new Response("Invalid payload", { status: 400 });
  }

  // Idempotent: unique(anonId, bookIndex, chapterIndex)
  await prisma.readingprogress.upsert({
    where: {
      anonId_bookIndex_chapterIndex: {
        anonId,
        bookIndex,
        chapterIndex,
      },
    },
    update: { completedAt: new Date() },
    create: {
      anonId,
      bookIndex,
      chapterIndex,
      completedAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const rows = await prisma.readingprogress.findMany({
    where: { anonId },
    orderBy: { completedAt: "desc" },
  });

  return Response.json(rows);
}
