import { promises as fs } from "fs";
import path from "path";
import { pathExists } from "./fs";

const ensurePathExport = async (file: string) => {
  if (!(await pathExists(file))) {
    return;
  }
  const content = await fs.readFile(file, "utf8");
  if (content.includes(".npm-global/bin")) {
    return;
  }
  const updated = `${content}\n# npm global packages\nexport PATH=\"$HOME/.npm-global/bin:$PATH\"\n`;
  await fs.writeFile(file, updated, "utf8");
};

export const configureShellHelpers = async (workspaceHome: string) => {
  await ensurePathExport(path.join(workspaceHome, ".bashrc"));
  await ensurePathExport(path.join(workspaceHome, ".zshrc"));
};
