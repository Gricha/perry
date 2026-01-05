import { promises as fs } from "fs";
import path from "path";
import { pathExists, ensureDir } from "./fs";
import { runCommand } from "./process";

export const installLazyVim = async (workspaceHome: string, hostHome: string, markerPath: string) => {
  if (await pathExists(markerPath)) {
    return;
  }
  const configDir = path.join(workspaceHome, ".config", "nvim");
  const hostConfigDir = path.join(hostHome, ".config", "nvim");
  const configInitLua = path.join(configDir, "init.lua");
  const configInitVim = path.join(configDir, "init.vim");
  if (await pathExists(configInitLua) || await pathExists(configInitVim)) {
    await runCommand("chown", ["-R", "workspace:workspace", path.join(workspaceHome, ".config")], { ignoreFailure: true });
    return;
  }
  const probe = await runCommand("sudo", ["test", "-d", hostConfigDir], { ignoreFailure: true });
  if (probe.code === 0) {
    await ensureDir(path.dirname(configDir));
    const copyResult = await runCommand("sudo", ["cp", "-r", hostConfigDir, configDir], { ignoreFailure: true });
    if (copyResult.code === 0) {
      await runCommand("sudo", ["chown", "-R", "workspace:workspace", configDir], { ignoreFailure: true });
      return;
    }
    await runCommand("sudo", ["rm", "-rf", configDir], { ignoreFailure: true });
  }
  if (await pathExists(configDir)) {
    console.log("Neovim config directory exists without init file. Installing LazyVim...");
  } else {
    console.log("Installing LazyVim as fallback...");
  }
  const cloneResult = await runCommand("git", ["clone", "https://github.com/LazyVim/starter", configDir], { ignoreFailure: true });
  if (cloneResult.code !== 0) {
    console.log("ERROR: Failed to install LazyVim!");
    console.log(`  Git error: ${cloneResult.stderr.trim() || cloneResult.stdout.trim()}`);
    console.log("  You will need to install a Neovim configuration manually.");
    return;
  }
  await runCommand("rm", ["-rf", path.join(configDir, ".git")], { ignoreFailure: true });
  await runCommand("chown", ["-R", "workspace:workspace", path.join(workspaceHome, ".config")], { ignoreFailure: true });
  console.log("✓ LazyVim installed successfully.");
  console.log("  Plugins will install on first 'nvim' launch.");
};
