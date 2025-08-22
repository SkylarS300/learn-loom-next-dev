// app/api/live/ping/route.js
import { cookies } from "next/headers";

// POST /api/live/ping  { classroomId?, mode? }
// Skeleton: acknowledges pings (no persistence yet). Useful for wiring client polling.
export async function POST(req) {
    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Accept body for future use (classroomId/mode/etc.)
    await req.json().catch(() => ({}));
    // No-op for MVP; GET /classrooms/:id/live derives presence from recent activity.
    return Response.json({ ok: true });
}
