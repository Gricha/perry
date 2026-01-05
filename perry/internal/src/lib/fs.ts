import { promises as fs } from "fs";
import path from "path";

export const pathExists = async (target: string) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

export const ensureDir = async (target: string) => {
  await fs.mkdir(target, { recursive: true });
};

export const readFileLines = async (target: string) => {
  const content = await fs.readFile(target, "utf8");
  return content.split("\n");
};

export const writeFileLines = async (target: string, lines: string[]) => {
  const payload = lines.length ? `${lines.join("\n")}\n` : "";
  await fs.writeFile(target, payload, "utf8");
};

const isExecutable = (mode: number) => (mode & 0o111) !== 0;

export const isExecutableFile = async (target: string) => {
  try {
    const stat = await fs.stat(target);
    return stat.isFile() && isExecutable(stat.mode);
  } catch {
    return false;
  }
};

export const listExecutableFiles = async (dir: string) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (await isExecutableFile(full)) {
        files.push(full);
      }
    }
    files.sort();
    return files;
  } catch {
    return [];
  }
};
