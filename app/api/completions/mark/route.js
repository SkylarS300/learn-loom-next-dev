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
          osis: userId,
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
      where: { assignmentId: aId, userId },
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
    console.error("❌ Completion POST error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classroomId = Number(searchParams.get("classroomId"));

    if (!classroomId) {
      return new Response("Missing classroomId", { status: 400 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { classroomId },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        category: true,
        subtopic: true,
        bookId: true,
        chapterIndex: true,
      },
    });


    const enrollments = await prisma.studentclassroom.findMany({
      where: { classroomId },
      include: { student: true },
    });

    if (enrollments.length === 0) {
      const fallback = assignments.map((assignment) => ({
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        userId: null,
        studentName: "No students enrolled",
        completed: false,
      }));
      return Response.json(fallback);
    }

    const completions = await prisma.assignmentcompletion.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        userId: { in: enrollments.map((e) => e.studentId) },
      },
    });

    const result = [];

    for (const student of enrollments) {
      for (const assignment of assignments) {
        const match = completions.find(
          (c) => c.assignmentId === assignment.id && c.userId === student.studentId
        );

        result.push({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          assignmentType: assignment.type,
          userId: student.studentId,
          studentName: `${student.student.firstName} ${student.student.lastName}`,
          completed: Boolean(match?.completedAt),
          completedAt: match?.completedAt ?? null,
          quizScore: match?.quizScore ?? null,
        });
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("Fetch classroom progress error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    const { assignmentId } = await request.json();

    const userId = Number(session?.user?.id);
    const aId = Number(assignmentId);

    if (!aId || !userId) {
      return new Response("Missing assignmentId or user session", { status: 400 });
    }

    const existing = await prisma.assignmentcompletion.findFirst({
      where: { assignmentId: aId, userId },
    });

    if (!existing || !existing.completedAt) {
      return new Response("Nothing to unmark", { status: 400 });
    }

    await prisma.assignmentcompletion.update({
      where: { id: existing.id },
      data: { completedAt: null, quizScore: null },
    });

    return Response.json({ unmarked: true });
  } catch (error) {
    console.error("Unmark error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
