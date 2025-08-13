// app/api/uploads/unlocked/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // ✅ Next 15: await cookies()
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return new Response("Unauthorized", { status: 401 });

    const unlocked = await prisma.uploadunlock.findMany({
      where: { anonId },
      select: { uploadId: true },
      orderBy: { createdAt: "desc" },
    });

    const uploadIds = unlocked.map(u => u.uploadId);
    if (uploadIds.length === 0) return Response.json([]);

    const uploads = await prisma.uploadedtext.findMany({
      where: { id: { in: uploadIds } },
      select: { id: true, title: true, password: true },
      orderBy: { createdAt: "desc" },
    });

    // Only titles + lock flags here (no content leak)
    return Response.json(
      uploads.map(u => ({
        id: u.id,
        title: u.title,
        password: !!u.password,
      }))
    );
  } catch (e) {
    console.error("GET /api/uploads/unlocked failed:", e);
    return new Response("Server error", { status: 500 });
  }
}
