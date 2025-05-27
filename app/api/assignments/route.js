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

    console.log("Received payload:", {
    title,
    type,
    classroomId,
    dueDate,
    description,
    category,
    subtopic,
  });

    if (!title || !type || !classroomId) {
      return new Response("Missing required fields", { status: 400 });
    }

    const allowedTypes = ["BOOK", "QUIZ", "UPLOAD"];
    if (!allowedTypes.includes(type)) {
      return new Response("Invalid assignment type", { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || "",
        type, // validated now
        dueDate: dueDate ? new Date(dueDate) : null,
        classroomId: parseInt(classroomId),
        category: category || null,
        subtopic: subtopic || null,
      },
    });

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
