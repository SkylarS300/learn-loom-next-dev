// app/api/session/logout/route.js
import { cookies } from "next/headers";
import { jsonOk } from "@/app/api/_util/auth";

export async function POST() {
    const cs = await cookies();
    // Clear host-scoped cookie
    cs.set("learnloomId", "", {
        path: "/",
        maxAge: 0,
        sameSite: "Lax",
        // no domain => clears host-only cookie
    });
    // Clear domain-scoped cookie (prod)
    cs.set("learnloomId", "", {
        path: "/",
        maxAge: 0,
        sameSite: "Lax",
        secure: true,
        domain: ".learnloom.xyz",
    });
    return jsonOk();
}
