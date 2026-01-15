import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export interface SessionNameRecord {
  workspaceName: string;
  sessionId: string;
  customName: string;
  updatedAt: string;
}

export interface SessionNamesStore {
  version: 1;
  names: Record<string, SessionNameRecord>;
}

function getNamesStorePath(stateDir: string): string {
  return join(stateDir, 'session-names.json');
}

function makeKey(workspaceName: string, sessionId: string): string {
  return `${workspaceName}:${sessionId}`;
}

async function loadStore(stateDir: string): Promise<SessionNamesStore> {
  const storePath = getNamesStorePath(stateDir);
  try {
    const content = await readFile(storePath, 'utf-8');
    return JSON.parse(content) as SessionNamesStore;
  } catch {
    return { version: 1, names: {} };
  }
}

async function saveStore(stateDir: string, store: SessionNamesStore): Promise<void> {
  const storePath = getNamesStorePath(stateDir);
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getSessionName(
  stateDir: string,
  workspaceName: string,
  sessionId: string
): Promise<string | null> {
  const store = await loadStore(stateDir);
  const key = makeKey(workspaceName, sessionId);
  return store.names[key]?.customName ?? null;
}

export async function setSessionName(
  stateDir: string,
  workspaceName: string,
  sessionId: string,
  customName: string
): Promise<void> {
  const store = await loadStore(stateDir);
  const key = makeKey(workspaceName, sessionId);
  store.names[key] = {
    workspaceName,
    sessionId,
    customName,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(stateDir, store);
}

export async function deleteSessionName(
  stateDir: string,
  workspaceName: string,
  sessionId: string
): Promise<void> {
  const store = await loadStore(stateDir);
  const key = makeKey(workspaceName, sessionId);
  delete store.names[key];
  await saveStore(stateDir, store);
}

export async function getSessionNamesForWorkspace(
  stateDir: string,
  workspaceName: string
): Promise<Record<string, string>> {
  const store = await loadStore(stateDir);
  const result: Record<string, string> = {};
  for (const [_key, record] of Object.entries(store.names)) {
    if (record.workspaceName === workspaceName) {
      result[record.sessionId] = record.customName;
    }
  }
  return result;
}
