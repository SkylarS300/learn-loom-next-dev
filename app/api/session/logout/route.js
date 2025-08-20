// app/api/session/logout/route.js
import { cookies } from "next/headers";

export async function POST() {
    const cs = await cookies();
    cs.set("learnloomId", "", { path: "/", maxAge: 0, sameSite: "Lax" }); // clear
    return Response.json({ ok: true });
}
