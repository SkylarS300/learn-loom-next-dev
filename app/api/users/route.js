// app/api/users/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";


export async function POST(request) {
  try {
    const { email, password, firstName, lastName, grade, role } = await request.json().catch(() => ({}));

    if (!email || !password || !firstName || !lastName || !role) {
      return Response.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return new Response("Invalid email", { status: 422 });
    }
    if (String(password).length < 8) {
      return new Response("Password too short", { status: 422 });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return Response.json({ ok: false, error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const gradeNum = Number.isFinite(parseInt(grade, 10)) ? parseInt(grade, 10) : null;


    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashedPassword,
        firstName,
        lastName,
        grade: gradeNum,
        role: role.toUpperCase() === "TEACHER" ? "TEACHER" : "STUDENT",
      },
    });

    const { password: _pw, ...safeUser } = user;
    return Response.json({ ok: true, data: safeUser });
  } catch (error) {
    console.error("Signup error:", error.message, error.stack);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }

}

export async function GET() {
  try {
    // Expose only non-sensitive fields
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, grade: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { id: "asc" },
    });
    return Response.json({ ok: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json({ ok: false, error: "Failed to fetch users" }, { status: 500 });
  }
}
