// scripts/gen-icons.js
const sharp = require("sharp");
import fs from "fs";

const sizes = [16, 32, 180, 192, 512]; // typical favicon & PWA sizes
const input = "public/favicon.ico";

if (!fs.existsSync(input)) {
    throw new Error("favicon.ico not found in /public");
}

for (const size of sizes) {
    sharp(input)
        .resize(size, size)
        .toFile(`public/favicon-${size}x${size}.png`)
        .then(() => console.log(`✅ Generated favicon-${size}x${size}.png`))
        .catch(err => console.error(err));
}
