import prisma from "../../../lib/prisma";

export async function POST(request) {
  try {
    const {
      title,
      description,
      type,
      dueDate,
      classroomId,
      category,
      subtopic,
    } = await request.json();

    if (!title || !type || !classroomId) {
      return new Response("Missing required fields", { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || "",
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
        classroomId: parseInt(classroomId),
        category: category || null,
        subtopic: subtopic || null,
      },
    });

    // Auto-create completion rows for grammar quiz assignments
    if (type === "QUIZ") {
      const students = await prisma.studentclassroom.findMany({
        where: { classroomId: parseInt(classroomId) },
        select: { studentId: true },
      });

      await prisma.assignmentcompletion.createMany({
        data: students.map((s) => ({
          userId: s.studentId,
          assignmentId: assignment.id,
        })),
        skipDuplicates: true,
      });
    }

    return Response.json(assignment);
  } catch (error) {
    console.error("Assignment creation error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacherId");

  if (!teacherId) {
    return new Response("Missing teacherId", { status: 400 });
  }

  try {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: Number(teacherId) },
      include: {
        assignments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    return Response.json(classrooms);
  } catch (error) {
    console.error("Fetch assignments error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
