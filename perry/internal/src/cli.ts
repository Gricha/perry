import { addSshKeys } from "./commands/add-ssh-key";
import { runEntrypoint } from "./commands/entrypoint";
import { runEnsureServices } from "./commands/ensure-services";
import { runInit } from "./commands/init";
import { syncUserWithHost } from "./commands/sync-user";

export const runCli = async () => {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case "entrypoint":
      await runEntrypoint();
      break;
    case "init":
      await runInit();
      break;
    case "ensure-services":
      await runEnsureServices();
      break;
    case "add-ssh-key":
      await addSshKeys();
      break;
    case "sync-user":
      await syncUserWithHost();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Available commands: entrypoint, init, ensure-services, add-ssh-key, sync-user");
      process.exitCode = 1;
      break;
  }
  if (rest.length) {
    void rest;
  }
};
