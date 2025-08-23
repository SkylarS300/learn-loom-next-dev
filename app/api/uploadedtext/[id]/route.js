import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { jsonOk, jsonErr } from "@/app/api/_util/auth";

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
        return jsonErr("Invalid id", 400);
    }

    const Body = z.object({
        visibility: z.enum(["PRIVATE", "CODED", "PUBLIC"]).optional(),
        action: z.enum(["regenCode"]).optional(),
    }).refine((v) => !!v.visibility || !!v.action, { message: "Provide visibility or action" });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return jsonErr("Invalid request", 422, { issues: parsed.error.issues });
    }
    const { visibility, action } = parsed.data;

    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) {
        return jsonErr("Unauthorized", 401);
    }

    // AuthZ: only owner can mutate
    const row = await prisma.uploadedtext.findUnique({ where: { id: uploadId } });
    if (!row || row.anonId !== anonId) {
        // Hide existence if not owner
        return jsonErr("Not found", 404);
    }

    const updates = {};
    // change visibility (PRIVATE | CODED | PUBLIC)
    if (visibility) {
        const vis = String(visibility).toUpperCase();
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
            return jsonErr("Code actions require CODED visibility", 422);
        }
        if (act === "regenCode") {
            updates.shareCode = genShareCode();
        } else {
            return jsonErr("Unknown action", 422);
        }
    }

    const updated = await prisma.uploadedtext.update({
        where: { id: uploadId },
        data: updates,
        select: { id: true, visibility: true, shareCode: true },
    });
    return jsonOk(updated);
}
