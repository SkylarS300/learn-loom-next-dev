// POST /api/live/ping
// Accepts { mode: "reading" | "grammar" | "upload" | "other" } and acks.
// We intentionally do NOT write; classroom “live” views derive activity from progress tables.
export async function POST(req) {
    // Best-effort parse; ignore content on failure
    await req.json().catch(() => ({}));
    return new Response(null, { status: 204 });
}

export async function GET() {
    // discourage polling this endpoint
    return Response.json({ ok: true, msg: "POST only" }, { status: 405 });
}