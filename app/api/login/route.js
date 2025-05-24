import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response("Missing credentials", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return new Response("Invalid email or password", { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return new Response("Invalid email or password", { status: 401 });
    }

    const { password: _, ...safeUser } = user;
    return Response.json(safeUser);
  } catch (error) {
    console.error("Login error:", error);
    const isValid = await bcrypt.compare(password, user.password);
    console.log("Password check:", password, "vs", user.password, "→", isValid);
    return new Response("Internal server error", { status: 500 });
  }
}
