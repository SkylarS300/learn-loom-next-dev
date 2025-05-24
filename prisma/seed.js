const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@example.com',
      password: 'test123',
      firstName: 'Alice',
      lastName: 'Anderson',
      grade: 12,
      role: 'TEACHER',
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@example.com',
      password: 'test123',
      firstName: 'Bob',
      lastName: 'Baker',
      grade: 11,
      role: 'STUDENT',
    },
  });

  const classroom = await prisma.classroom.create({
    data: {
      name: 'Biology',
      code: 'BIO-123',
      teacherId: teacher.id,
    },
  });

  await prisma.studentclassroom.create({
    data: {
      studentId: student.id,
      classroomId: classroom.id,
    },
  });

  await prisma.assignment.create({
    data: {
      title: 'Read Chapter 3',
      description: 'Read and be ready for discussion',
      type: 'BOOK',
      classroomId: classroom.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('🌱 Seed complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
