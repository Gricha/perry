import path from "path";
import { promises as fs } from "fs";
import { ensureDir, pathExists, readFileLines, writeFileLines } from "../lib/fs";
import { runCommand } from "../lib/process";

export const addSshKeys = async () => {
  const workspaceHome = process.env.WORKSPACE_HOME ?? "/home/workspace";
  const sshDir = path.join(workspaceHome, ".ssh");
  await ensureDir(sshDir);
  const hostSshDir = "/host/home/.ssh";
  if (await pathExists(hostSshDir)) {
    await runCommand("cp", ["-r", `${hostSshDir}/.`, sshDir], { ignoreFailure: true });
  }
  const authorizedKeys = path.join(sshDir, "authorized_keys");
  if (!(await pathExists(authorizedKeys))) {
    await writeFileLines(authorizedKeys, []);
  }
  const publicKey = process.env.SSH_PUBLIC_KEY ?? "";
  if (publicKey) {
    const lines = (await readFileLines(authorizedKeys)).map((line) => line.trim()).filter((line) => line);
    if (!lines.includes(publicKey)) {
      lines.push(publicKey);
      lines.sort();
      await writeFileLines(authorizedKeys, lines);
    }
  }
  const finalLines = (await readFileLines(authorizedKeys)).map((line) => line.trim()).filter((line) => line);
  finalLines.sort();
  await writeFileLines(authorizedKeys, finalLines);
  await runCommand("chown", ["-R", "workspace:workspace", sshDir], { ignoreFailure: true });
  await fs.chmod(sshDir, 0o700);
  const entries = await fs.readdir(sshDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      continue;
    }
    const full = path.join(sshDir, entry.name);
    if (entry.name === "authorized_keys") {
      await fs.chmod(full, 0o600);
      continue;
    }
    if (entry.name === "known_hosts" || entry.name === "config" || entry.name.endsWith(".pub")) {
      await fs.chmod(full, 0o644);
    } else {
      await fs.chmod(full, 0o600);
    }
  }
};
