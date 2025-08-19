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

    // --- params ---
    const scope = url.searchParams.get("scope"); // "current" or null
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
    const cursorParam = url.searchParams.get("cursor"); // id (no q) OR numeric offset (with q)
    const typeParam = (url.searchParams.get("type") || "").trim(); // 'book' | 'upload' | 'grammar' | 'all'

    const qRaw = (url.searchParams.get("q") || "");     // keep raw for FTS; we lowercase only for client filters elsewhere
    const q = qRaw.trim().toLowerCase();

    const tagsParam = (url.searchParams.get("tags") || "").trim();
    const tags = tagsParam ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const fields = (url.searchParams.get("fields") || "").trim(); // e.g., "lite"

    // optional anchors
    const bookIndex = url.searchParams.get("bookIndex");
    const chapterIndex = url.searchParams.get("chapterIndex");
    const uploadIdParam = url.searchParams.get("uploadId");
    const concept = url.searchParams.get("concept");
    const subTopic = url.searchParams.get("subTopic");

    // --- base where ---
    const whereBase = { anonId };
    if (typeParam && typeParam !== "all") whereBase.targetType = typeParam;

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

    // --- projection ---
    const select =
        fields === "lite"
            ? {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, /* body omitted */ tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            }
            : {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, body: true, tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            };

    // helper: tag filter (ANY)
    const tagMatch = (row) => {
        if (!tags.length) return true;
        const tagList = Array.isArray(row.tagsJson) ? row.tagsJson : [];
        return tags.some((t) => tagList.includes(t));
    };

    try {
        if (!q) {
            // --- A) No search term: use createdAt desc + id desc with id cursor ---
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

        // --- B) Search term present: MySQL FTS with relevance; numeric offset cursor ---
        const offset = Number.isFinite(Number(cursorParam)) ? Number(cursorParam) : 0;
        const pageTake = Math.min(limit * 3, 300); // over-fetch to survive tag filtering

        const buildSearchWhere = () => ({
            AND: [
                whereBase,
                { OR: [{ body: { search: qRaw } }, { anchorText: { search: qRaw } }] },
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
                    { _relevance: { fields: ["body", "anchorText"], search: qRaw, sort: "desc" } },
                    { createdAt: "desc" },
                ],
                select,
                skip: runningOffset,
                take: pageTake,
            });
            if (!rows.length) break;

            const filtered = rows.filter(tagMatch);
            collected.push(...filtered);
            runningOffset += rows.length; // advance by raw rows
            if (rows.length < pageTake) break; // end of data
        }

        const nextCursor = collected.length >= limit ? String(runningOffset) : null;
        return Response.json({ ok: true, data: collected.slice(0, limit), nextCursor });
    } catch (e) {
        // Fallback when FTS is unavailable (e.g., P2030: missing index)
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
                                    { body: { contains: qRaw } },
                                    { anchorText: { contains: qRaw } },
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
