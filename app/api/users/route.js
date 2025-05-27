// app/api/users/route.js
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";


export async function POST(request) {
  try {
    const { email, password, firstName, lastName, grade, role } = await request.json();

    if (!email || !password || !firstName || !lastName || !role) {
      return new Response("Missing required fields", { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return new Response("Email already in use", { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        grade: parseInt(grade),
        role: role.toUpperCase() === "TEACHER" ? "TEACHER" : "STUDENT",
      },
    });

    const { password: _, ...safeUser } = user;
    return Response.json(safeUser);
  } catch (error) {
      console.error("Signup error:", error.message, error.stack); // <== Add this
      return new Response("Internal server error", { status: 500 });
  }

}

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    return Response.json(users);
  } catch (error) {
      console.error("Error fetching users:", error);
      return new Response("Failed to fetch users", { status: 500 });
  }
}
