import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Upsert a bookmark for (anonId, bookIndex, chapterIndex)
export async function POST(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { bookIndex, chapterIndex, sentenceIndex, timeMs } = await req.json();

    if (!Number.isFinite(bookIndex) || !Number.isFinite(chapterIndex)) {
        return Response.json({ ok: false, error: "Invalid indices" }, { status: 400 });
    }

    try {
        const row = await prisma.readingprogress.upsert({
            where: { anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex } },
            update: {
                sentenceIndex: Number.isFinite(sentenceIndex) ? sentenceIndex : null,
                timeMs: Number.isFinite(timeMs) ? timeMs : undefined,
            },
            create: {
                anonId,
                bookIndex,
                chapterIndex,
                sentenceIndex: Number.isFinite(sentenceIndex) ? sentenceIndex : null,
                timeMs: Number.isFinite(timeMs) ? timeMs : 0,
            },
        });
        return Response.json({ ok: true, data: row });
    } catch (e) {
        console.error("bookmark POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}

// Read a bookmark for (anonId, bookIndex, chapterIndex)
export async function GET(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const bookIndex = Number(searchParams.get("bookIndex"));
    const chapterIndex = Number(searchParams.get("chapterIndex"));

    if (!Number.isFinite(bookIndex) || !Number.isFinite(chapterIndex)) {
        return Response.json({ ok: false, error: "Invalid indices" }, { status: 400 });
    }

    try {
        const row = await prisma.readingprogress.findUnique({
            where: { anonId_bookIndex_chapterIndex: { anonId, bookIndex, chapterIndex } },
            select: { sentenceIndex: true, timeMs: true, updatedAt: true },
        });
        return Response.json({ ok: true, data: row ?? null });
    } catch (e) {
        console.error("bookmark GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
