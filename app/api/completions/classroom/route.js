// app/api/completions/classroom/route.js
import prisma from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get("classroomId");

  if (!classroomId) {
    return new Response("Missing classroomId", { status: 400 });
  }

  try {
    const students = await prisma.studentclassroom.findMany({
      where: { classroomId: Number(classroomId) },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const allAssignments = await prisma.assignment.findMany({
      where: { classroomId: Number(classroomId) },
      orderBy: { dueDate: "asc" },
    });

    const completions = await prisma.assignmentcompletion.findMany({
      where: {
        assignmentId: { in: allAssignments.map((a) => a.id) },
      },
    });

    const response = students.map(({ student }) => {
      const studentCompletions = completions.filter(
        (c) => c.userId === student.id
      );

      return {
        student,
        assignments: allAssignments.map((a) => {
          const completion = studentCompletions.find((c) => c.assignmentId === a.id);
          return {
            id: a.id,
            title: a.title,
            type: a.type,
            dueDate: a.dueDate,
            completedAt: completion?.completedAt ?? null,
            quizScore: completion?.quizScore ?? null,
          };
        }),
      };
    });

    return Response.json(response);
  } catch (error) {
    console.error("Progress fetch error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
