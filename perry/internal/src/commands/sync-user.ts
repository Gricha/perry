import { runCommand } from "../lib/process";

const getCurrentUid = async (username: string): Promise<number> => {
  const result = await runCommand("id", ["-u", username]);
  return parseInt(result.stdout.trim(), 10);
};

const getCurrentGid = async (username: string): Promise<number> => {
  const result = await runCommand("id", ["-g", username]);
  return parseInt(result.stdout.trim(), 10);
};

const getUserName = async (uid: number): Promise<string | null> => {
  try {
    const result = await runCommand("getent", ["passwd", String(uid)]);
    return result.stdout.split(":")[0] || null;
  } catch {
    return null;
  }
};

const getGroupName = async (gid: number): Promise<string | null> => {
  try {
    const result = await runCommand("getent", ["group", String(gid)]);
    return result.stdout.split(":")[0] || null;
  } catch {
    return null;
  }
};

export const syncUserWithHost = async () => {
  const hostUid = process.env.HOST_UID;
  const hostGid = process.env.HOST_GID;
  const workspaceHome = "/home/workspace";

  if (!hostUid || !hostGid) {
    console.log("[sync-user] HOST_UID/HOST_GID not set, skipping user sync");
    return;
  }

  const uid = parseInt(hostUid, 10);
  const gid = parseInt(hostGid, 10);

  if (Number.isNaN(uid) || Number.isNaN(gid)) {
    console.log("[sync-user] Invalid HOST_UID/HOST_GID values, skipping");
    return;
  }

  if (uid === 0 || gid === 0) {
    console.log("[sync-user] Refusing to sync root user for security");
    return;
  }

  const currentUid = await getCurrentUid("workspace");
  const currentGid = await getCurrentGid("workspace");

  if (currentUid === uid && currentGid === gid) {
    console.log(`[sync-user] Already synced (${uid}:${gid})`);
    return;
  }

  console.log(`[sync-user] Syncing workspace user: ${currentUid}:${currentGid} → ${uid}:${gid}`);

  try {
    await runCommand("groupmod", ["-g", String(gid), "workspace"], { ignoreFailure: false });
  } catch (e) {
    const conflictGroup = await getGroupName(gid);
    if (conflictGroup && conflictGroup !== "workspace") {
      console.log(`[sync-user] GID ${gid} conflict with group ${conflictGroup}, resolving...`);
      await runCommand("groupmod", ["-g", "60000", conflictGroup], { ignoreFailure: true });
      await runCommand("groupmod", ["-g", String(gid), "workspace"], { ignoreFailure: false });
    } else {
      throw e;
    }
  }

  try {
    await runCommand("usermod", ["-u", String(uid), "-g", String(gid), "workspace"], { ignoreFailure: false });
  } catch (e) {
    const conflictUser = await getUserName(uid);
    if (conflictUser && conflictUser !== "workspace") {
      console.log(`[sync-user] UID ${uid} conflict with user ${conflictUser}, resolving...`);
      await runCommand("usermod", ["-u", "60000", conflictUser], { ignoreFailure: true });
      await runCommand("usermod", ["-u", String(uid), "-g", String(gid), "workspace"], { ignoreFailure: false });
    } else {
      throw e;
    }
  }

  console.log("[sync-user] Updating file ownership...");
  await runCommand("chown", ["-R", `${uid}:${gid}`, workspaceHome], { ignoreFailure: true });
  await runCommand("chown", ["-R", `${uid}:${gid}`, "/home/workspace/.cache"], { ignoreFailure: true });

  console.log("[sync-user] User sync complete");
};
