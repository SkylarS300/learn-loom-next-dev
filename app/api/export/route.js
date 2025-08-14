import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import books from "@/src/content/book-content.js";
import JSZip from "jszip";

// CSV helper
function toCSV(headers, rows) {
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        const needsQuotes = /[",\n]/.test(s);
        const quoted = `"${s.replace(/"/g, '""')}"`;
        return needsQuotes ? quoted : s;
    };
    const head = headers.map(esc).join(",");
    const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
    return `${head}\n${body}\n`;
}

export async function GET(req) {
    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") || "all").toLowerCase();

    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) {
        return NextResponse.json(
            { ok: false, error: "Missing anonymous ID (learnloomId)" },
            { status: 401 }
        );
    }

    // Fetch all three datasets (cheap and simple)
    const [reading, grammar, uploads] = await Promise.all([
        prisma.readingprogress.findMany({
            where: { anonId },
            orderBy: [{ updatedAt: "desc" }, { completedAt: "desc" }],
            select: { bookIndex: true, chapterIndex: true, sentenceIndex: true, timeMs: true, updatedAt: true, completedAt: true },
        }),
        prisma.grammarprogress.findMany({
            where: { anonId },
            orderBy: { createdAt: "desc" },
            select: { concept: true, subTopic: true, score: true, createdAt: true },
        }),
        prisma.uploadprogress.findMany({
            where: { anonId },
            orderBy: { updatedAt: "desc" },
            select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true },
        }),
    ]);

    // Build CSVs
    const readingHeaders = ["bookIndex", "bookTitle", "chapterIndex", "sentenceIndex", "timeMs", "updatedAt", "completedAt"];
    const readingRows = reading.map((r) => ({
        bookIndex: r.bookIndex,
        bookTitle: books?.[r.bookIndex]?.title || `Book #${r.bookIndex}`,
        chapterIndex: r.chapterIndex ?? "",
        sentenceIndex: r.sentenceIndex ?? "",
        timeMs: r.timeMs ?? "",
        updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt,
        completedAt: r.completedAt?.toISOString?.() || r.completedAt,
    }));
    const readingCSV = toCSV(readingHeaders, readingRows);

    const grammarHeaders = ["concept", "subTopic", "score", "createdAt"];
    const grammarRows = grammar.map((g) => ({
        concept: g.concept,
        subTopic: g.subTopic ?? "",
        score: g.score,
        createdAt: g.createdAt?.toISOString?.() || g.createdAt,
    }));
    const grammarCSV = toCSV(grammarHeaders, grammarRows);

    const uploadsHeaders = ["uploadId", "paraIndex", "charOffset", "updatedAt"];
    const uploadsRows = uploads.map((u) => ({
        uploadId: u.uploadId,
        paraIndex: u.paraIndex ?? "",
        charOffset: u.charOffset ?? "",
        updatedAt: u.updatedAt?.toISOString?.() || u.updatedAt,
    }));
    const uploadsCSV = toCSV(uploadsHeaders, uploadsRows);

    // Serve
    if (kind === "reading") {
        return new NextResponse(readingCSV, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="reading.csv"',
            },
        });
    }
    if (kind === "grammar") {
        return new NextResponse(grammarCSV, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="grammar.csv"',
            },
        });
    }
    if (kind === "uploads") {
        return new NextResponse(uploadsCSV, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="uploads.csv"',
            },
        });
    }

    // kind === "all" → ZIP of all three
    const zip = new JSZip();
    zip.file("reading.csv", readingCSV);
    zip.file("grammar.csv", grammarCSV);
    zip.file("uploads.csv", uploadsCSV);
    const blob = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(blob, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="all_exports.zip"',
        },
    });
}
