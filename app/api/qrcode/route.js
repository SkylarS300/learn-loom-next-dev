import QRCode from "qrcode";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || "";
    const buf = await QRCode.toBuffer(text, { width: 256, margin: 1 });
    return new Response(buf, {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
