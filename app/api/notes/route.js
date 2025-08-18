// app/api/notes/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function unauthorized() {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return unauthorized();

    const url = new URL(req.url);
    const scope = url.searchParams.get("scope"); // "current" or null
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
    const qRaw = (url.searchParams.get("q") || "").trim();
    const q = qRaw.toLowerCase();
    const tagsParam = (url.searchParams.get("tags") || "").trim();
    const tags = tagsParam ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const fields = (url.searchParams.get("fields") || "").trim(); // e.g., "lite"
    const typeParam = (url.searchParams.get("type") || "").trim(); // 'book' | 'upload' | 'grammar' | ''
    const cursorParam = (url.searchParams.get("cursor") || "").trim(); // ISO createdAt

    // optional anchors
    const bookIndex = url.searchParams.get("bookIndex");
    const chapterIndex = url.searchParams.get("chapterIndex");
    const uploadIdParam = url.searchParams.get("uploadId");
    const concept = url.searchParams.get("concept");
    const subTopic = url.searchParams.get("subTopic");

    const where = { anonId };
    if (typeParam && ["book", "upload", "grammar"].includes(typeParam)) {
        where.targetType = typeParam;
    }

    // Narrow to current reading location if provided
    if (scope === "current") {
        if (bookIndex != null) where.bookIndex = Number(bookIndex);
        if (chapterIndex != null) where.chapterIndex = Number(chapterIndex);
        if (uploadIdParam != null && uploadIdParam !== "") {
            const upId = Number(uploadIdParam);
            if (!Number.isNaN(upId)) where.uploadId = upId;
        }
    }

    if (concept) where.concept = String(concept);
    if (subTopic) where.subTopic = String(subTopic);
    // Server-side pushdown for text search on body/anchor (keeps tag matching client-side)
    if (qRaw) {
        where.OR = [
            { body: { contains: qRaw } },
            { anchorText: { contains: qRaw } },
        ];
    }
    // We deliberately avoid DB-level JSON tag filters for MySQL portability.
    // Fetch a larger page and filter in-process by tags and q-in-tags.
    const select =
        fields === "lite"
            ? {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, /* body omitted in lite */ tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            }
            : {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, body: true, tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            };

    const take = Math.min(limit * 4, 400);
    const cursorWhere =
        cursorParam
            ? { createdAt: { lt: new Date(cursorParam) } }
            : {};

    const rows = await prisma.note.findMany({
        where: { ...where, ...cursorWhere },
        orderBy: { createdAt: "desc" },
        take,
        select,
    });

    const filtered = rows.filter((r) => {
        const tagList = Array.isArray(r.tagsJson) ? r.tagsJson : [];
        // "ANY" semantics: show if it has at least one of the requested tags
        const matchesTags = tags.length ? tags.some((t) => tagList.includes(t)) : true;
        // Keep q-in-tags behavior client-side (pushdown handled body/anchor above)
        const qHit =
            !q ||
            (r.body?.toLowerCase?.().includes(q) ?? false) ||
            r.anchorText?.toLowerCase().includes(q) ||
            tagList.some((t) => String(t).toLowerCase().includes(q));
        return matchesTags && qHit;
    });
    const items = filtered.slice(0, limit);
    // nextCursor logic:
    // - If we had >limit filtered items, advance to the createdAt of the last included item.
    // - Else, if we hit our take window exactly, advance to last row's createdAt to keep scanning older pages.
    let nextCursor = null;
    if (filtered.length > limit && items.length) {
        nextCursor = items[items.length - 1]?.createdAt?.toISOString?.() || null;
    } else if (rows.length === take && rows.length > 0) {
        nextCursor = rows[rows.length - 1]?.createdAt?.toISOString?.() || null;
    }
    return Response.json({ ok: true, data: items, nextCursor });
}


export async function POST(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
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

    const uploadIdNum =
        uploadId === 0 || uploadId === "0"
            ? 0
            : uploadId != null && uploadId !== "" && !Number.isNaN(Number(uploadId))
                ? Number(uploadId)
                : null;


    const row = await prisma.note.create({
        data: {
            anonId,
            targetType,
            bookIndex: Number.isInteger(bookIndex) ? Number(bookIndex) : null,
            uploadId: uploadIdNum,
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
