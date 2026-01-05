import { pathExists } from "./fs";
import { runCommand } from "./process";

export const installDevTools = async (markerPath: string) => {
  if (await pathExists(markerPath)) {
    return;
  }
  await ensureCodex();
  await ensureOpencode();
};

const ensureCodex = async () => {
  console.log("Installing codex...");
  const codexCheck = await runCommand("which", ["codex"], { ignoreFailure: true });
  if (codexCheck.code !== 0) {
    const installResult = await runCommand("npm", ["install", "-g", "@openai/codex"], { ignoreFailure: true });
    if (installResult.code === 0) {
      console.log("✓ codex installed successfully.");
    } else {
      console.log("WARNING: Failed to install codex.");
    }
    return;
  }
  const updateResult = await runCommand("npm", ["update", "-g", "@openai/codex"], { ignoreFailure: true });
  if (updateResult.code === 0) {
    console.log("✓ codex updated successfully.");
  } else {
    console.log("WARNING: Failed to update codex.");
  }
};

const resolveOpencodeArch = async () => {
  const result = await runCommand("dpkg", ["--print-architecture"], { ignoreFailure: true });
  const value = result.stdout.trim().toLowerCase();
  if (value === "amd64" || value === "x86_64") {
    return "x64";
  }
  if (value === "arm64" || value === "aarch64") {
    return "arm64";
  }
  return "x64";
};

const ensureOpencode = async () => {
  const versionCheck = await runCommand("which", ["opencode"], { ignoreFailure: true });
  const installing = versionCheck.code !== 0;
  console.log(installing ? "Installing opencode..." : "Updating opencode...");
  const arch = await resolveOpencodeArch();
  const script = [
    "set -eo pipefail",
    'tmp=$(mktemp -d)',
    'cleanup() { rm -rf "$tmp"; }',
    "trap cleanup EXIT",
    `curl -fsSL "https://github.com/sst/opencode/releases/latest/download/opencode-linux-${arch}.zip" -o "$tmp/opencode.zip"`,
    'unzip -q "$tmp/opencode.zip" -d "$tmp/opencode"',
    'sudo install -m 0755 "$tmp/opencode/opencode" /usr/local/bin/opencode',
  ].join("\n");
  const installResult = await runCommand("bash", ["-c", script], { ignoreFailure: true });
  if (installResult.code === 0) {
    const verify = await runCommand("which", ["opencode"], { ignoreFailure: true });
    if (verify.code === 0) {
      const version = await runCommand("/usr/local/bin/opencode", ["--version"], { ignoreFailure: true });
      if (version.code === 0) {
        console.log(`✓ opencode ${version.stdout.trim()} ready.`);
      } else {
        console.log("✓ opencode installed.");
      }
    } else {
      console.log("✓ opencode installed.");
    }
    return;
  }
  if (installResult.stderr.trim()) {
    console.log(`WARNING: Failed to install opencode: ${installResult.stderr.trim()}`);
  } else {
    console.log("WARNING: Failed to install opencode.");
  }
};
