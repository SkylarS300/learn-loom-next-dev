// app/api/uploads/[id]/route.js
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { z } from "zod";

// small helper for CODED visibility
function genShareCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/**
 * GET /api/uploads/:id
 * Return the full upload content ONLY if the anon user has unlocked it.
 */
export async function GET(_req, context) {
  try {
    const { params } = context;
    const { id } = await params; // Next 15 pattern
    const uploadId = Number(id);

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId || !uploadId) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check unlock
    const unlocked = await prisma.uploadunlock.findUnique({
      where: { anonId_uploadId: { anonId, uploadId } },
    });
    if (!unlocked) {
      return Response.json({ ok: false, error: "Locked" }, { status: 403 });
    }

    const upload = await prisma.uploadedtext.findUnique({
      where: { id: uploadId },
      select: { id: true, title: true, content: true },
    });

    if (!upload) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json(upload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("/api/uploads/[id] GET failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/uploads/:id
 * Body:
 *   { visibility: "PRIVATE" | "PUBLIC" | "CODED" }
 *   OR { action: "regenCode" }
 * Requires ownership (same anonId).
 */
export async function PATCH(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    const uploadId = Number(id);

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId || !uploadId) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const upload = await prisma.uploadedtext.findUnique({
      where: { id: uploadId },
      select: { id: true, anonId: true, visibility: true, shareCode: true },
    });
    if (!upload || upload.anonId !== anonId) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const Body = z.object({
      visibility: z.enum(["PRIVATE", "PUBLIC", "CODED"]).optional(),
      action: z.enum(["regenCode"]).optional(),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ ok: false, error: "Bad request" }, { status: 422 });
    }
    const { visibility, action } = parsed.data;

    if (action === "regenCode") {
      const newCode = genShareCode();
      const updated = await prisma.uploadedtext.update({
        where: { id: uploadId },
        data: { shareCode: newCode },
      });
      return Response.json({ ok: true, shareCode: updated.shareCode });
    }

    if (visibility) {
      const patch = {
        visibility,
        ...(visibility === "CODED" && !upload.shareCode ? { shareCode: genShareCode() } : {}),
      };
      const updated = await prisma.uploadedtext.update({
        where: { id: uploadId },
        data: patch,
      });
      return Response.json({
        ok: true,
        data: { visibility: updated.visibility, shareCode: updated.shareCode ?? null },
      });
    }

    return Response.json({ ok: false, error: "No-op" }, { status: 400 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("/api/uploads/[id] PATCH failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
