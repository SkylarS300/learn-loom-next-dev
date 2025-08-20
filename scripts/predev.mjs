// scripts/predev.mjs
import { existsSync } from "fs";
import { spawnSync } from "child_process";

const hasLock = existsSync("package-lock.json");
const hasNodeModules = existsSync("node_modules");
const hasNext = existsSync("node_modules/next/package.json");

if (!hasNodeModules || !hasNext) {
    const cmd = hasLock ? ["ci"] : ["install"];
    console.log(`▶ Installing dependencies (npm ${cmd[0]})...`);
    const r = spawnSync("npm", cmd, { stdio: "inherit", shell: true });
    if (r.status !== 0) {
        console.error(`✖ npm ${cmd[0]} failed`);
        process.exit(r.status || 1);
    }
}
