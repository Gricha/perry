import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

export interface SSHKeyInfo {
  name: string;
  path: string;
  publicKeyPath: string;
  type: 'ed25519' | 'rsa' | 'ecdsa' | 'dsa' | 'unknown';
  fingerprint: string;
  hasPrivateKey: boolean;
}

const KEY_PATTERNS = ['id_ed25519', 'id_rsa', 'id_ecdsa', 'id_dsa'];

function parseKeyType(content: string): SSHKeyInfo['type'] {
  if (content.includes('ssh-ed25519')) return 'ed25519';
  if (content.includes('ssh-rsa')) return 'rsa';
  if (content.includes('ecdsa-sha2')) return 'ecdsa';
  if (content.includes('ssh-dss')) return 'dsa';
  return 'unknown';
}

function computeFingerprint(publicKeyContent: string): string {
  const parts = publicKeyContent.trim().split(' ');
  if (parts.length < 2) return 'invalid';

  const keyData = Buffer.from(parts[1], 'base64');
  const hash = createHash('sha256').update(keyData).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

export async function getSSHDir(): Promise<string> {
  return join(homedir(), '.ssh');
}

export async function discoverSSHKeys(): Promise<SSHKeyInfo[]> {
  const sshDir = await getSSHDir();
  const keys: SSHKeyInfo[] = [];

  let files: string[];
  try {
    files = await readdir(sshDir);
  } catch {
    return [];
  }

  const pubFiles = files.filter((f) => f.endsWith('.pub'));

  for (const pubFile of pubFiles) {
    const baseName = pubFile.replace('.pub', '');
    const publicKeyPath = join(sshDir, pubFile);
    const privateKeyPath = join(sshDir, baseName);

    try {
      const publicKeyContent = await readFile(publicKeyPath, 'utf-8');
      const type = parseKeyType(publicKeyContent);
      const fingerprint = computeFingerprint(publicKeyContent);

      let hasPrivateKey = false;
      try {
        const privStat = await stat(privateKeyPath);
        hasPrivateKey = privStat.isFile();
      } catch {
        hasPrivateKey = false;
      }

      keys.push({
        name: baseName,
        path: privateKeyPath,
        publicKeyPath,
        type,
        fingerprint,
        hasPrivateKey,
      });
    } catch {
      continue;
    }
  }

  keys.sort((a, b) => {
    const aIsStandard = KEY_PATTERNS.includes(a.name);
    const bIsStandard = KEY_PATTERNS.includes(b.name);
    if (aIsStandard && !bIsStandard) return -1;
    if (!aIsStandard && bIsStandard) return 1;
    return a.name.localeCompare(b.name);
  });

  return keys;
}

export async function readPublicKey(keyPath: string): Promise<string | null> {
  const pubPath = keyPath.endsWith('.pub') ? keyPath : `${keyPath}.pub`;
  try {
    return await readFile(pubPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function readPrivateKey(keyPath: string): Promise<string | null> {
  const privPath = keyPath.endsWith('.pub') ? keyPath.replace('.pub', '') : keyPath;
  try {
    return await readFile(privPath, 'utf-8');
  } catch {
    return null;
  }
}
