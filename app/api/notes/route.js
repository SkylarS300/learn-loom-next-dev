// app/api/notes/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function unauthorized() {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req) {
    const anonId = cookies().get("learnloomId")?.value;
    if (!anonId) return unauthorized();

    const url = new URL(req.url);
    const scope = url.searchParams.get("scope"); // "current" or null
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
    const qRaw = (url.searchParams.get("q") || "").trim();
    const q = qRaw.toLowerCase();
    const tagsParam = (url.searchParams.get("tags") || "").trim();
    const tags = tagsParam ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    // optional anchors
    const bookIndex = url.searchParams.get("bookIndex");
    const chapterIndex = url.searchParams.get("chapterIndex");
    const uploadId = url.searchParams.get("uploadId");
    const concept = url.searchParams.get("concept");
    const subTopic = url.searchParams.get("subTopic");

    const where = { anonId };

    // Narrow to current reading location if provided
    if (scope === "current") {
        if (bookIndex != null) where.bookIndex = Number(bookIndex);
        if (chapterIndex != null) where.chapterIndex = Number(chapterIndex);
        if (uploadId) where.uploadId = String(uploadId);
    }

    if (concept) where.concept = String(concept);
    if (subTopic) where.subTopic = String(subTopic);
    // We deliberately avoid DB-level JSON tag filters for MySQL portability.
    // Fetch a larger page and filter in-process by tags and q-in-tags.
    const rows = await prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit * 4, 400),
        select: {
            id: true, targetType: true, bookIndex: true, uploadId: true,
            chapterIndex: true, sentenceIndex: true, wordIndex: true,
            concept: true, subTopic: true, promptHash: true,
            anchorText: true, body: true, tagsJson: true, color: true,
            isBookmark: true, createdAt: true, updatedAt: true,
        },
    });
    const filtered = rows.filter((r) => {
        const tagList = Array.isArray(r.tagsJson) ? r.tagsJson : [];
        const matchesTags = tags.length ? tags.every((t) => tagList.includes(t)) : true;
        const qHit =
            !q ||
            r.body?.toLowerCase().includes(q) ||
            r.anchorText?.toLowerCase().includes(q) ||
            tagList.some((t) => String(t).toLowerCase().includes(q));
        return matchesTags && qHit;
    });
    return Response.json({ ok: true, data: filtered.slice(0, limit) });
}


export async function POST(req) {
    const anonId = cookies().get("learnloomId")?.value;
    if (!anonId) return unauthorized();

    const payload = await req.json().catch(() => ({}));
    const {
        targetType, // 'book' | 'upload' | 'grammar'
        bookIndex, uploadId, chapterIndex, sentenceIndex, wordIndex,
        concept, subTopic, promptHash,
        anchorText,
        body,
        tags = [],
        color,
        isBookmark = false,
    } = payload || {};

    if (!targetType || typeof body !== "string" || !body.trim()) {
        return Response.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }
    if (body.length > 2000) {
        return Response.json({ ok: false, error: "Note too long (max 2000 chars)" }, { status: 400 });
    }

    const cleanTags = Array.isArray(tags)
        ? tags.map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 10)
        : [];

    const row = await prisma.note.create({
        data: {
            anonId,
            targetType,
            bookIndex: Number.isInteger(bookIndex) ? Number(bookIndex) : null,
            uploadId: uploadId ? String(uploadId) : null,
            chapterIndex: Number.isInteger(chapterIndex) ? Number(chapterIndex) : null,
            sentenceIndex: Number.isInteger(sentenceIndex) ? Number(sentenceIndex) : null,
            wordIndex: Number.isInteger(wordIndex) ? Number(wordIndex) : null,
            concept: concept || null,
            subTopic: subTopic || null,
            promptHash: promptHash || null,
            anchorText: anchorText?.slice(0, 200) || null,
            body: body.trim(),
            tagsJson: cleanTags,
            color: color || null,
            isBookmark: !!isBookmark,
        },
    });
    return Response.json({ ok: true, data: row });
}
