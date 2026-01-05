import { promises as fs } from "fs";
import path from "path";
import { listExecutableFiles, isExecutableFile } from "./fs";
import { runCommand } from "./process";
import type { RuntimeConfig } from "./runtime";

type BootstrapEntry = {
  source: "project" | "user";
  path: string;
};

export const buildBootstrapEntries = (config: RuntimeConfig | null): BootstrapEntry[] => {
  const entries: BootstrapEntry[] = [];
  if (!config?.bootstrap?.scripts) {
    return entries;
  }
  for (const script of config.bootstrap.scripts) {
    if (typeof script === "string") {
      const trimmed = script.trim();
      if (trimmed) {
        entries.push({ source: "project", path: trimmed });
      }
      continue;
    }
    if (!script || typeof script !== "object") {
      continue;
    }
    const source = script.source === "user" ? "user" : "project";
    const rawPath = script.path ?? "";
    const trimmed = rawPath.trim();
    if (trimmed) {
      entries.push({ source, path: trimmed });
    }
  }
  return entries;
};

export const runBootstrapScripts = async (workspaceHome: string, entries: BootstrapEntry[]) => {
  if (!entries.length) {
    return;
  }
  console.log("Running bootstrap scripts...");
  for (const entry of entries) {
    const baseDir = entry.source === "user" ? "/workspace/userconfig" : "/workspace/source";
    const scriptPath = path.join(baseDir, entry.path);
    const stat = await fs.stat(scriptPath).catch(() => null);
    if (!stat) {
      console.log(`ERROR: Bootstrap script not found: ${scriptPath}`);
      if (entry.source === "user") {
        console.log("Scripts should be in ~/.config/perry/ or subdirectories");
      } else {
        console.log("Scripts should be in the directory with .workspace.yml");
      }
      throw new Error("bootstrap script missing");
    }
    if (stat.isDirectory()) {
      const scripts = await listExecutableFiles(scriptPath);
      for (const file of scripts) {
        console.log(`→ ${entry.path}/${path.basename(file)}`);
        const result = await runCommand(file, [], { cwd: workspaceHome, ignoreFailure: true });
        if (result.code !== 0) {
          console.log(`ERROR: Bootstrap script failed: ${entry.path}/${path.basename(file)}`);
          throw new Error("bootstrap script failed");
        }
      }
      continue;
    }
    if (!(await isExecutableFile(scriptPath))) {
      console.log(`ERROR: Bootstrap script is not executable: ${scriptPath}`);
      if (entry.source === "user") {
        console.log(`Hint: Run 'chmod +x ~/.config/perry/${entry.path}' on your host machine`);
      } else {
        console.log(`Hint: Run 'chmod +x ${entry.path}' on your host machine`);
      }
      throw new Error("bootstrap script not executable");
    }
    console.log(`→ ${entry.path}`);
    const result = await runCommand(scriptPath, [], { cwd: workspaceHome, ignoreFailure: true });
    if (result.code !== 0) {
      console.log(`ERROR: Bootstrap script failed: ${entry.path}`);
      throw new Error("bootstrap script failed");
    }
  }
};
