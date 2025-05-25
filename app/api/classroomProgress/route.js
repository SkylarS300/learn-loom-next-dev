// app/api/classroomProgress/route.js
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const data = await Promise.all(
      students.map(async ({ student }) => {
        const completions = await prisma.assignmentcompletion.findMany({
          where: {
            userId: student.id,
            assignment: {
              classroomId: Number(classroomId),
            },
          },
          include: {
            assignment: {
              select: {
                id: true,
                title: true,
                type: true,
                dueDate: true,
              },
            },
          },
        });

        return {
          student,
          assignments: completions.map((c) => ({
            id: c.assignment.id,
            title: c.assignment.title,
            type: c.assignment.type,
            dueDate: c.assignment.dueDate,
            completedAt: c.completedAt,
            quizScore: c.quizScore,
          })),
        };
      })
    );

    return Response.json(data);
  } catch (error) {
    console.error("Progress fetch error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
