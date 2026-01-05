import { ensureDockerd, monitorServices, startSshd, waitForDocker } from "../lib/services";

export const runEnsureServices = async () => {
  ensureDockerd();
  const ready = await waitForDocker();
  if (!ready) {
    process.exit(1);
    return;
  }
  await startSshd();
  await monitorServices();
};
