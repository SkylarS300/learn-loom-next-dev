// app/api/uploads/[id]/route.js
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

/**
 * GET /api/uploads/:id
 * Returns the full upload content ONLY if the anon user has unlocked it.
 */
export async function GET(_req, context) {
  try {
    const { params } = context;
    const { id } = await params; //  Next 15 requires await
    const uploadId = Number(id);

    const cookieStore = await cookies(); //  Next 15 requires await
    const anonId = cookieStore.get("learnloomId")?.value;

    if (!anonId || !uploadId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check if this anonId has unlocked this upload
    const unlocked = await prisma.uploadunlock.findUnique({
      where: { anonId_uploadId: { anonId, uploadId } },
    });
    if (!unlocked) {
      return new Response("Locked", { status: 403 });
    }

    const upload = await prisma.uploadedtext.findUnique({
      where: { id: uploadId },
      select: { id: true, title: true, content: true },
    });

    if (!upload) return new Response("Not found", { status: 404 });
    return Response.json(upload);
  } catch (e) {
    console.error("/api/uploads/[id] GET failed:", e);
    return new Response("Server error", { status: 500 });
  }
}
