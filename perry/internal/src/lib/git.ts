import { promises as fs } from "fs";
import path from "path";
import { ensureDir, pathExists } from "./fs";
import { runCommand } from "./process";

const extractHost = (remote: string) => {
  const sshMatch = remote.match(/^[^@]+@([^:]+)(?::.*)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }
  const sshUrlMatch = remote.match(/^ssh:\/\/([^\/]+)\//);
  if (sshUrlMatch) {
    return sshUrlMatch[1];
  }
  return "";
};

export const ensureKnownHost = async (workspaceHome: string, remote: string) => {
  const host = extractHost(remote);
  if (!host) {
    return;
  }
  const sshDir = path.join(workspaceHome, ".ssh");
  await ensureDir(sshDir);
  await runCommand("chown", ["workspace:workspace", sshDir], { ignoreFailure: true });
  await fs.chmod(sshDir, 0o700);
  const knownHostsPath = path.join(sshDir, "known_hosts");
  if (!(await pathExists(knownHostsPath))) {
    await fs.writeFile(knownHostsPath, "", "utf8");
    await fs.chmod(knownHostsPath, 0o644);
    await runCommand("chown", ["workspace:workspace", knownHostsPath], { ignoreFailure: true });
  }
  const check = await runCommand("ssh-keygen", ["-F", host, "-f", knownHostsPath], { ignoreFailure: true });
  if (check.code !== 0) {
    const scan = await runCommand("ssh-keyscan", ["-H", host], { ignoreFailure: true });
    if (scan.stdout.trim()) {
      await fs.appendFile(knownHostsPath, `${scan.stdout.replace(/\s+$/, "")}\n`, "utf8");
    }
  }
};

export const configureGitSshKey = async (workspaceHome: string, repoDir: string, key: string) => {
  const keyPath = path.join(workspaceHome, ".ssh", key);
  if (!(await pathExists(repoDir)) || !(await pathExists(keyPath))) {
    return;
  }
  await runCommand("git", ["config", "--local", "core.sshCommand", `ssh -i ~/.ssh/${key} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`], {
    cwd: repoDir,
    ignoreFailure: true,
  });
};

export const copyGitConfig = async (workspaceHome: string, hostHome: string) => {
  const hostGitConfig = path.join(hostHome, ".gitconfig");
  const target = path.join(workspaceHome, ".gitconfig");
  const probe = await runCommand("sudo", ["test", "-f", hostGitConfig], { ignoreFailure: true });
  if (probe.code !== 0) {
    return;
  }
  await runCommand("sudo", ["cp", hostGitConfig, target], { ignoreFailure: true });
  await runCommand("sudo", ["chown", "workspace:workspace", target], { ignoreFailure: true });
};
