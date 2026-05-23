import { execSync } from "child_process";

if (process.env.VERCEL || process.env.CI) {
  console.log("[postbuild] Skipping react-snap (no Chrome in build environment).");
} else {
  console.log("[postbuild] Running react-snap...");
  execSync("react-snap", { stdio: "inherit" });
}
