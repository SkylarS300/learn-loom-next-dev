import prisma from "@/lib/prisma";
import { cookies } from "next/headers"; // 🍪 to read anonId from cookie

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const anonId = cookieStore.get("learnloomId")?.value;

    const { assignmentId, completedAt } = await request.json();
    const aId = Number(assignmentId);
    const now = completedAt ? new Date(completedAt) : new Date();

    if (!aId || !anonId) {
      return new Response("Missing assignmentId or anonymous ID", { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({ where: { id: aId } });

    if (!assignment) {
      return new Response("Assignment not found", { status: 404 });
    }

    let score = null;

    if (assignment.type === "QUIZ") {
      const category = assignment.category;
      const subtopic = assignment.subtopic;

      if (!category || !subtopic) {
        return new Response("Missing quiz category or subtopic on assignment", { status: 400 });
      }

      const latest = await prisma.grammarprogress.findFirst({
        where: {
          anonId: anonId,
          concept: category,
          subTopic: subtopic,
        },
        orderBy: { createdAt: "desc" },
      });

      if (latest) {
        score = latest.score ?? null;
      }
    }

    const existing = await prisma.assignmentcompletion.findFirst({
      where: { assignmentId: aId, anonId },
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
        anonId,
        completedAt: now,
        quizScore: score,
      },
    });

    return Response.json(newCompletion);
  } catch (error) {
    console.error("❌ Completion POST error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
