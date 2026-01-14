import { spawn } from "child_process";
import fs from "fs";
import { delay, runCommand } from "./process";
import { pathExists } from "./fs";

const TS_STATE_DIR = "/var/lib/tailscale";
const TS_SOCKET = "/var/run/tailscale/tailscaled.sock";
const logPath = "/var/log/tailscaled.log";

let tailscaledProcess: ReturnType<typeof spawn> | null = null;

export const startTailscaled = () => {
  fs.mkdirSync(TS_STATE_DIR, { recursive: true });

  const stream = fs.createWriteStream(logPath, { flags: "a" });
  const child = spawn("tailscaled", ["--state=" + TS_STATE_DIR + "/tailscaled.state", "--socket=" + TS_SOCKET], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.pipe(stream, { end: false });
  child.stderr?.pipe(stream, { end: false });

  child.once("exit", (code) => {
    stream.write(`[tailscaled] exited with code ${code}\n`);
    stream.end();
    tailscaledProcess = null;
  });

  child.once("error", (error) => {
    stream.write(`[tailscaled] error: ${error.message}\n`);
    stream.end();
    tailscaledProcess = null;
  });

  tailscaledProcess = child;
  return child;
};

export const ensureTailscaled = () => {
  if (!tailscaledProcess) {
    startTailscaled();
  }
  return tailscaledProcess;
};

export const waitForTailscaled = async (): Promise<boolean> => {
  console.log("[tailscale] Waiting for tailscaled to be ready...");
  for (let i = 1; i <= 15; i += 1) {
    const result = await runCommand("tailscale", ["status"], { ignoreFailure: true });
    if (result.code === 0 || result.stderr.includes("Logged out")) {
      console.log(`[tailscale] tailscaled is ready (took ${i}s)`);
      return true;
    }
    await delay(1000);
  }
  console.log("[tailscale] ERROR: tailscaled failed to start after 15 seconds");
  if (await pathExists(logPath)) {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const tail = lines.slice(-20);
    console.log("[tailscale] Logs:");
    for (const line of tail) {
      console.log(line);
    }
  }
  return false;
};

export const isTailscaleInstalled = async (): Promise<boolean> => {
  try {
    const result = await runCommand("which", ["tailscale"], { ignoreFailure: true });
    return result.code === 0;
  } catch {
    return false;
  }
};
