// app/api/uploads/[id]/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(req, context) {
  try {
    const cookieStore = await cookies(); // ⬅️ await
    const anonId = cookieStore.get("learnloomId")?.value;

    const { id } = await context.params; // ⬅️ await
    const uploadId = Number(id);

    if (!anonId || !uploadId) return new Response("Unauthorized", { status: 401 });

    const upload = await prisma.uploadedtext.findUnique({
      where: { id: uploadId },
      select: { id: true, title: true, content: true, password: true },
    });
    if (!upload) return new Response("Not Found", { status: 404 });

    if (upload.password) {
      const unlocked = await prisma.uploadunlock.findUnique({
        where: { anonId_uploadId: { anonId, uploadId } },
        select: { id: true },
      });
      if (!unlocked) {
        return Response.json({ id: upload.id, title: upload.title, password: true, content: null });
      }
    }

    return Response.json({
      id: upload.id,
      title: upload.title,
      password: !!upload.password,
      content: upload.content,
    });
  } catch (e) {
    console.error("GET /api/uploads/[id] failed:", e);
    return new Response("Server error", { status: 500 });
  }
}
