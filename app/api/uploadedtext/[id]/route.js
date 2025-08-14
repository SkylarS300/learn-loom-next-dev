import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Simple URL-safe code
function genShareCode(len = 6) {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
}

export async function PATCH(req, ctx) {
    const { params } = ctx || {};
    const { id } = await params; // Next 15 idiom
    const uploadId = Number(id);
    if (!Number.isInteger(uploadId)) {
        return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { visibility, action } = body || {};

    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // AuthZ: only owner can mutate
    const row = await prisma.uploadedtext.findUnique({ where: { id: uploadId } });
    if (!row || row.anonId !== anonId) {
        // Hide existence if not owner
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const updates = {};
    // change visibility (PRIVATE | CODED | PUBLIC)
    if (visibility) {
        const vis = String(visibility).toUpperCase();
        if (!["PRIVATE", "CODED", "PUBLIC"].includes(vis)) {
            return NextResponse.json({ ok: false, error: "Invalid visibility" }, { status: 422 });
        }
        updates.visibility = vis;
        // If switching away from CODED, drop code; if switching to CODED, ensure a code exists
        if (vis !== "CODED") {
            updates.shareCode = null;
        } else if (!row.shareCode) {
            updates.shareCode = genShareCode();
        }
    }

    // optional actions on code (only valid for CODED)
    if (action) {
        const act = String(action);
        if (row.visibility !== "CODED" && updates.visibility !== "CODED") {
            return NextResponse.json({ ok: false, error: "Code actions require CODED visibility" }, { status: 422 });
        }
        if (act === "regenCode") {
            updates.shareCode = genShareCode();
        } else {
            return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 422 });
        }
    }

    const updated = await prisma.uploadedtext.update({
        where: { id: uploadId },
        data: updates,
        select: { id: true, visibility: true, shareCode: true },
    });
    return NextResponse.json({ ok: true, data: updated });
}
