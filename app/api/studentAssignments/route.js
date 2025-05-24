import prisma from "../../../lib/prisma";
console.log("Prisma import test:", prisma);

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return new Response("Missing studentId", { status: 400 });
  }

  try {
      const links = await prisma.studentclassroom.findMany({
      where: { studentId: Number(studentId) },
      select: { classroomId: true },
    });

    const classroomIds = links.map(link => link.classroomId);

    const assignments = await prisma.assignment.findMany({
      where: { classroomId: { in: classroomIds } },
      orderBy: { dueDate: "asc" },
      include: {
        completions: {
          where: { userId: Number(studentId) },
          select: { completedAt: true, quizScore: true },
        },
        classroom: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    const response = assignments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate,
      classroom: a.classroom,
      completedAt: a.completions[0]?.completedAt || null,
      quizScore: a.completions[0]?.quizScore ?? null,
    }));

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch assignments error:", error.message);
    return new Response("Internal server error", { status: 500 });
  }
}
