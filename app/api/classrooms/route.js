function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
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

  if (!teacherId) {
    return new Response("Missing teacherId", { status: 400 });
  }

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

