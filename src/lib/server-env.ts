const envSource = import.meta.env as Record<string, string | undefined>;

export function readServerEnv(key: string) {
  return envSource[key] ?? process.env[key];
}

export function readServerEnvTrimmed(key: string) {
  return readServerEnv(key)?.trim();
}

export function isServerEnvEnabled(key: string) {
  return readServerEnvTrimmed(key) === '1';
}