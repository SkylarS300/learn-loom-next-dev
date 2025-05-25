import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { code, studentId } = await request.json();

    if (!code || !studentId) {
      return new Response("Missing code or studentId", { status: 400 });
    }

    const classroom = await prisma.classroom.findUnique({
      where: { code },
    });

    if (!classroom) {
      return new Response("Classroom not found", { status: 404 });
    }

    const existingLink = await prisma.studentclassroom.findFirst({
      where: {
        classroomId: classroom.id,
        studentId: Number(studentId),
      },
    });

    if (existingLink) {
      return new Response("Already joined", { status: 409 });
    }

    await prisma.studentclassroom.create({
      data: {
        classroomId: classroom.id,
        studentId: Number(studentId),
      },
    });

    return Response.json(classroom);
  } catch (error) {
    console.error("Join error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return new Response("Missing studentId", { status: 400 });
  }

  const data = await prisma.studentclassroom.findMany({
    where: { studentId: Number(studentId) },
    select: {
      classroom: true,
    },
    distinct: ["classroomId"],
  });

  return Response.json(data.map((entry) => entry.classroom));
}

