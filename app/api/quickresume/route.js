import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  const c = await cookies();
  const anonId = c.get("learnloomId")?.value;
  if (!anonId) {
    return NextResponse.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
  }

  try {
    const [read, upload, grammar] = await Promise.all([
      prisma.readingprogress.findFirst({
        where: { anonId },
        orderBy: [{ updatedAt: "desc" }, { completedAt: "desc" }],
        select: { bookIndex: true, chapterIndex: true, sentenceIndex: true, timeMs: true, updatedAt: true },
      }),
      prisma.uploadprogress.findFirst({
        where: { anonId },
        orderBy: { updatedAt: "desc" },
        select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true },
      }),
      prisma.grammarprogress.findFirst({
        where: { anonId },
        orderBy: { createdAt: "desc" },
        select: { concept: true, subTopic: true, score: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        reading: read ?? null,
        upload: upload ?? null,
        grammar: grammar ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Failed to fetch quick resume" }, { status: 500 });
  }
}
