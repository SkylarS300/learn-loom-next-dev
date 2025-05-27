import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "../../../lib/prisma";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { category, subtopic, score } = body;

    if (!session?.user?.id || !category || !subtopic || score == null) {
      return new Response("Missing fields", { status: 400 });
    }

    const userId = Number(session.user.id);

    // Log quiz progress
    await prisma.quizprogress.create({
      data: {
        userId,
        category,
        subtopic,
        score,
      },
    });

    // Get all classrooms the student is part of
    const studentClassrooms = await prisma.studentclassroom.findMany({
      where: { studentId: userId },
      select: { classroomId: true },
    });

    const classroomIds = studentClassrooms.map((sc) => sc.classroomId);

    if (classroomIds.length === 0) {
      return new Response("No linked classrooms", { status: 200 });
    }

    // Find matching quiz assignments by category + subtopic
    const matchingAssignments = await prisma.assignment.findMany({
      where: {
        type: "QUIZ",
        category,
        subtopic,
        classroomId: { in: classroomIds },
      },
      select: { id: true },
    });

    const assignmentIds = matchingAssignments.map((a) => a.id);

    if (assignmentIds.length > 0) {
      // Update assignmentcompletion rows
      await Promise.all(
        assignmentIds.map((assignmentId) =>
          prisma.assignmentcompletion.updateMany({
            where: {
              userId,
              assignmentId,
            },
            data: {
              completedAt: new Date(),
              quizScore: score,
            },
          })
        )
      );
    }

    return new Response("Quiz progress logged", { status: 200 });
  } catch (error) {
    console.error("Quiz progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}
