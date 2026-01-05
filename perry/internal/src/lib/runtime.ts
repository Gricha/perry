import { readJson } from "./process";

export type RuntimeConfig = {
  ssh?: {
    selectedKey?: string;
  };
  workspace?: {
    repo?: {
      cloneArgs?: string[];
    };
  };
  bootstrap?: {
    scripts?: Array<string | {
      path?: string;
      source?: string;
    }>;
  };
};

export const loadRuntimeConfig = async (target: string) => {
  return readJson<RuntimeConfig>(target);
};
