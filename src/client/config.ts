import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CONFIG_DIR, CLIENT_CONFIG_FILE, type ClientConfig } from '../shared/types';

function getClientConfigPath(configDir?: string): string {
  return path.join(configDir || DEFAULT_CONFIG_DIR, CLIENT_CONFIG_FILE);
}

export async function loadClientConfig(configDir?: string): Promise<ClientConfig | null> {
  const configPath = getClientConfigPath(configDir);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as ClientConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function saveClientConfig(config: ClientConfig, configDir?: string): Promise<void> {
  const configPath = getClientConfigPath(configDir);
  const dir = path.dirname(configPath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function getWorker(configDir?: string): Promise<string | null> {
  const config = await loadClientConfig(configDir);
  return config?.worker || null;
}

export async function setWorker(worker: string, configDir?: string): Promise<void> {
  const config = (await loadClientConfig(configDir)) || { worker: '' };
  config.worker = worker;
  await saveClientConfig(config, configDir);
}
