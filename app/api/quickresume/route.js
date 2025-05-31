import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const [latestRead, latestUpload, latestQuiz] = await Promise.all([
    prisma.readingprogress.findFirst({
      where: { anonId },
      orderBy: { completedAt: "desc" },
    }),
    prisma.uploadedtext.findFirst({
      where: { anonId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.grammarprogress.findFirst({
      where: { anonId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return Response.json({ latestRead, latestUpload, latestQuiz });
}
