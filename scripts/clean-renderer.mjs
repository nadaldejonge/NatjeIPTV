import fs from "node:fs";

fs.rmSync("dist/renderer", { recursive: true, force: true });
