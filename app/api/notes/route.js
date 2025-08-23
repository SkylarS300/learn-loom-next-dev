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
    const scope = url.searchParams.get("scope");
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const cursorParam = url.searchParams.get("cursor"); // id (no q) OR numeric offset (with q)
    const typeParam = (url.searchParams.get("type") || "").trim(); // 'book' | 'upload' | 'grammar' | 'all'
    const q = (url.searchParams.get("q") || "").trim();             // keep raw (MySQL FTS)
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

    const select =
        fields === "lite"
            ? {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            }
            : {
                id: true, targetType: true, bookIndex: true, uploadId: true,
                chapterIndex: true, sentenceIndex: true, wordIndex: true,
                concept: true, subTopic: true, promptHash: true,
                anchorText: true, body: true, tagsJson: true, color: true,
                isBookmark: true, createdAt: true, updatedAt: true,
            };

    const tagMatch = (row) => {
        if (!tags.length) return true;
        const tagList = Array.isArray(row.tagsJson) ? row.tagsJson : [];
        return tags.some((t) => tagList.includes(t)); // ANY semantics
    };

    try {
        if (!q) {
            // No search term → stable id cursor, newest first
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
                if (batch.length < pageTake) break;
            }

            return Response.json({
                ok: true,
                data: collected.slice(0, limit),
                nextCursor: collected.length >= limit ? cursorId : null,
            });
        }

        // Search term present → MySQL FTS, relevance order, numeric offset
        const offset = Number.isFinite(Number(cursorParam)) ? Number(cursorParam) : 0;
        const pageTake = Math.min(limit * 3, 300);
        const buildSearchWhere = () => ({
            AND: [
                whereBase,
                { OR: [{ body: { search: q } }, { anchorText: { search: q } }] },
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
            collected.push(...rows.filter(tagMatch));
            runningOffset += rows.length;
            if (rows.length < pageTake) break;
        }

        return Response.json({
            ok: true,
            data: collected.slice(0, limit),
            nextCursor: collected.length >= limit ? String(runningOffset) : null,
        });
    } catch (e) {
        // Missing FTS index → degrade to contains()
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
                            { OR: [{ body: { contains: q } }, { anchorText: { contains: q } }] },
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
            return Response.json({
                ok: true,
                data: collected.slice(0, limit),
                nextCursor: collected.length >= limit ? String(runningOffset) : null,
                degraded: true,
            });
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
    return Response.json({ ok: true, data: row }, { status: 201 });
}
