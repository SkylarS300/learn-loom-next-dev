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
    const cursorParam = url.searchParams.get("cursor"); // id (no q) OR numeric offset (with q)
    const typeParam = (url.searchParams.get("type") || "").trim(); // 'book' | 'upload' | 'grammar' | 'all'
    // sanitize q: keep as-is for MySQL boolean mode, but trim & cap length
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const tagsParam = (url.searchParams.get("tags") || "").trim();
    const tags = tagsParam ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const fields = (url.searchParams.get("fields") || "").trim(); // e.g., "lite"

    // optional anchors
    const bookIndex = url.searchParams.get("bookIndex");
    const chapterIndex = url.searchParams.get("chapterIndex");
    const uploadIdParam = url.searchParams.get("uploadId");
    const concept = url.searchParams.get("concept");
    const subTopic = url.searchParams.get("subTopic");

    const whereBase = { anonId };
    if (typeParam && typeParam !== "all") whereBase.targetType = typeParam;

    // Narrow to current reading location if provided
    if (scope === "current") {
        if (bookIndex != null) whereBase.bookIndex = Number(bookIndex);
        if (chapterIndex != null) whereBase.chapterIndex = Number(chapterIndex);
        if (uploadIdParam != null && uploadIdParam !== "") {
            const upId = Number(uploadIdParam);
            if (!Number.isNaN(upId)) whereBase.uploadId = upId;
        }
    }

    if (concept) whereBase.concept = String(concept);
    if (subTopic) whereBase.subTopic = String(subTopic);

    // Server-side pushdown for text search on body/anchor (keeps tag matching client-side)
    if (qRaw) {
        where.OR = [
            { body: { contains: qRaw } },
            { anchorText: { contains: qRaw } },
        ];
    }
    // We'll over-fetch and filter in-process for tags (and when fields=lite).
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

    // helpers
    const tagMatch = (row) => {
        if (!tags.length) return true;
        const tagList = Array.isArray(row.tagsJson) ? row.tagsJson : [];
        return tags.some((t) => tagList.includes(t)); // ANY semantics
    };

    // --- Two modes: (A) q empty -> id cursor; (B) q present -> offset cursor with relevance order ---
    try {
        if (!q) {
            // A) No search term: createdAt desc, id desc, stable id cursor
            const pageTake = Math.min(limit * 3, 300); // over-fetch to survive tag filtering
            let cursorId = cursorParam || null;
            let collected = [];
            let safety = 0;
            let lastBatchLastId = null;
            while (collected.length < limit && safety < 6) {
                safety++;
                const batch = await prisma.note.findMany({
                    where: whereBase,
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    select,
                    take: pageTake,
                    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
                });
                if (!batch.length) break;
                lastBatchLastId = batch[batch.length - 1].id;
                for (const row of batch) {
                    if (tagMatch(row)) collected.push(row);
                    if (collected.length >= limit) break;
                }
                cursorId = lastBatchLastId;
                if (batch.length < pageTake) break; // end of data
            }
            const hasMore = Boolean(lastBatchLastId);
            return Response.json({
                ok: true,
                data: collected.slice(0, limit),
                nextCursor: hasMore ? lastBatchLastId : null,
            });
        }

        // B) Search term present: MySQL FTS with relevance; use numeric offset cursor
        const offset = Number.isFinite(Number(cursorParam)) ? Number(cursorParam) : 0;
        const pageTake = Math.min(limit * 3, 300); // over-fetch to survive tag filtering
        const buildSearchWhere = () => ({
            AND: [
                whereBase,
                {
                    OR: [
                        { body: { search: q } },
                        { anchorText: { search: q } },
                    ],
                },
            ],
        });
        let collected = [];
        let runningOffset = offset;
        let safety = 0;

        while (collected.length < limit && safety < 4) {
            safety++;
            const rows = await prisma.note.findMany({
                where: buildSearchWhere(),
                orderBy: [
                    { _relevance: { fields: ["body", "anchorText"], search: q, sort: "desc" } },
                    { createdAt: "desc" },
                ],
                select,
                skip: runningOffset,
                take: pageTake,
            });
            if (!rows.length) break;
            const filtered = rows.filter(tagMatch);
            collected.push(...filtered);
            runningOffset += rows.length; // advance offset by raw rows
            if (rows.length < pageTake) break; // end of data
        }

        const nextCursor = collected.length >= limit ? String(runningOffset) : null;
        return Response.json({ ok: true, data: collected.slice(0, limit), nextCursor });
    } catch (e) {
        // Known Prisma error when FT index is missing -> fall back to slow "contains" search
        if (e?.code === "P2030") {
            const offset = Number.isFinite(Number(cursorParam)) ? Number(cursorParam) : 0;
            const pageTake = Math.min(limit * 3, 300);
            let collected = [];
            let runningOffset = offset;
            let safety = 0;
            while (collected.length < limit && safety < 4) {
                safety++;
                const rows = await prisma.note.findMany({
                    where: {
                        AND: [
                            whereBase,
                            {
                                OR: [
                                    { body: { contains: q } },
                                    { anchorText: { contains: q } },
                                ],
                            },
                        ],
                    },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    select,
                    skip: runningOffset,
                    take: pageTake,
                });
                if (!rows.length) break;
                collected.push(...rows.filter(tagMatch));
                runningOffset += rows.length;
                if (rows.length < pageTake) break;
            }
            const nextCursor = collected.length >= limit ? String(runningOffset) : null;
            return Response.json({ ok: true, data: collected.slice(0, limit), nextCursor, degraded: true });
        }
        return Response.json({ ok: false, error: e?.message || "Search failed" }, { status: 500 });
    }

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
