// app/api/session/logout/route.js
import { cookies } from "next/headers";
import { jsonOk } from "@/app/api/_util/auth";

export async function POST() {
    const cs = await cookies();
    cs.set("learnloomId", "", { path: "/", maxAge: 0, sameSite: "Lax" }); // clear
    return jsonOk();
}
