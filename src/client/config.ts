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
    const config = JSON.parse(content) as ClientConfig;
    // Migration: rename 'worker' to 'agent' if old config exists
    if ('worker' in config && !(config as ClientConfig).agent) {
      (config as ClientConfig).agent = (config as { worker?: string }).worker;
      delete (config as { worker?: string }).worker;
      await saveClientConfig(config, configDir);
    }
    return config;
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

export async function getAgent(configDir?: string): Promise<string | null> {
  const config = await loadClientConfig(configDir);
  return config?.agent || null;
}

export async function setAgent(agent: string, configDir?: string): Promise<void> {
  const config = (await loadClientConfig(configDir)) || { agent: '' };
  config.agent = agent;
  await saveClientConfig(config, configDir);
}

export async function getToken(configDir?: string): Promise<string | null> {
  const config = await loadClientConfig(configDir);
  return config?.token || null;
}

export async function setToken(token: string, configDir?: string): Promise<void> {
  const config = (await loadClientConfig(configDir)) || {};
  config.token = token;
  await saveClientConfig(config, configDir);
}

// Legacy aliases for backwards compatibility
export const getWorker = getAgent;
export const setWorker = setAgent;
