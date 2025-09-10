// POST /api/live/ping
// Accepts { mode: "reading" | "grammar" | "upload" | "other" } and acks.
// We intentionally do NOT write; classroom “live” views derive activity from progress tables.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    // Best-effort parse; ignore content on failure
    await req.json().catch(() => ({}));
    return new Response(null, { status: 204 });
}

export async function GET() {
    // discourage polling this endpoint
    return Response.json({ ok: false, error: "Method Not Allowed (POST only)" }, { status: 405 });
}