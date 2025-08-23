import QRCode from "qrcode";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const text = (searchParams.get("text") || "").toString();
        if (!text.trim()) return new Response("Missing text", { status: 422 });
        const buf = await QRCode.toBuffer(text, { width: 256, margin: 1 });
        return new Response(buf, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return new Response("QR encode failed", { status: 500 });
    }
}
