import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const unlocked = await prisma.uploadunlock.findMany({
    where: { anonId },
    select: { uploadId: true },
  });

  const uploadIds = unlocked.map((u) => u.uploadId);

  const uploads = await prisma.uploadedtext.findMany({
    where: {
      id: { in: uploadIds },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(uploads);
}
