import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { assignmentId, completedAt } = await request.json();

    const userId = Number(session?.user?.id);
    const aId = Number(assignmentId);
    const now = completedAt ? new Date(completedAt) : new Date();

    if (!aId || !userId) {
      return new Response("Missing assignmentId or user session", { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: aId },
    });

    let score = null;
    if (assignment?.type === "QUIZ") {
      const latest = await prisma.grammarprogress.findFirst({
        where: { osis: userId },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        score = latest.score ?? null;
      }
    }

    const existing = await prisma.assignmentcompletion.findFirst({
      where: {
        assignmentId: aId,
        userId,
      },
    });

    if (existing) {
      await prisma.assignmentcompletion.update({
        where: { id: existing.id },
        data: {
          completedAt: existing.completedAt || now,
          quizScore: score,
        },
      });
      return Response.json({ updated: true });
    }

    const newCompletion = await prisma.assignmentcompletion.create({
      data: {
        assignmentId: aId,
        userId,
        completedAt: now,
        quizScore: score,
      },
    });

    return Response.json(newCompletion);
  } catch (error) {
    console.error("Completion error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
