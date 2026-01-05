import { spawn } from "child_process";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  ignoreFailure?: boolean;
  logFile?: string;
  input?: string;
};

export type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export class CommandError extends Error {
  command: string;
  args: string[];
  code: number;
  stdout: string;
  stderr: string;

  constructor(command: string, args: string[], code: number, stdout: string, stderr: string) {
    super(`${command} ${args.join(" ")} failed with code ${code}`);
    this.command = command;
    this.args = args;
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const runCommand = async (command: string, args: string[], options: RunOptions = {}): Promise<RunResult> => {
  const childEnv = { ...process.env, ...options.env };
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let logStream: fsSync.WriteStream | null = null;
  if (options.logFile) {
    const dir = path.dirname(options.logFile);
    fsSync.mkdirSync(dir, { recursive: true });
    logStream = fsSync.createWriteStream(options.logFile, { flags: "a" });
  }

  child.stdout?.on("data", (chunk) => {
    stdout.push(Buffer.from(chunk));
    logStream?.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr.push(Buffer.from(chunk));
    logStream?.write(chunk);
  });

  const result = await new Promise<RunResult>((resolve, reject) => {
    child.once("close", (code) => {
      logStream?.end();
      const finalCode = typeof code === "number" ? code : 1;
      const finalStdout = Buffer.concat(stdout).toString("utf8");
      const finalStderr = Buffer.concat(stderr).toString("utf8");
      if (finalCode !== 0 && !options.ignoreFailure) {
        reject(new CommandError(command, args, finalCode, finalStdout, finalStderr));
        return;
      }
      resolve({ code: finalCode, stdout: finalStdout, stderr: finalStderr });
    });
    child.once("error", (error) => {
      logStream?.end();
      reject(error);
    });
  });

  if (options.input) {
    child.stdin?.write(options.input);
  }
  child.stdin?.end();

  return result;
};

export const readJson = async <T>(target: string): Promise<T | null> => {
  try {
    const content = await fs.readFile(target, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};
