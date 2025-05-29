import { prisma } from "@/lib/prisma";

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request) {
  try {
    const { name, teacherId } = await request.json();

    if (!name || !teacherId) {
      return new Response("Missing name or teacherId", { status: 400 });
    }

    const code = generateCode();

    const classroom = await prisma.classroom.create({
      data: {
        name,
        teacherId: parseInt(teacherId),
        code,
      },
    });

    return Response.json(classroom);
  } catch (error) {
    console.error("API error:", error.message, error.stack);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacherId");
  const studentId = searchParams.get("studentId");

  // ✅ Return teacher’s full classroom list with codes
  if (teacherId) {
    const classrooms = await prisma.classroom.findMany({
      where: {
        teacherId: parseInt(teacherId),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        assignments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    return Response.json(classrooms);
  }

  // 🚫 Return student classroom list without codes
  if (studentId) {
    const studentClassrooms = await prisma.studentclassroom.findMany({
      where: {
        studentId: parseInt(studentId),
      },
      include: {
        classroom: {
          include: {
            assignments: {
              orderBy: { dueDate: "asc" },
            },
          },
        },
      },
    });

    const sanitized = studentClassrooms.map((entry) => {
      const { id, name, teacherId, assignments } = entry.classroom;
      return { id, name, teacherId, assignments };
    });

    return Response.json(sanitized);
  }

  return new Response("Missing teacherId or studentId", { status: 400 });
}
