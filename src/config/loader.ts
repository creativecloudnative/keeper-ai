import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { KeeperConfigSchema, KeeperConfig } from './schema';

let _config: KeeperConfig | null = null;

export function loadConfig(): KeeperConfig {
  if (_config) return _config;

  const configPath = path.resolve(process.env.KEEPER_CONFIG_PATH ?? './config/services.yaml');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = yaml.load(fs.readFileSync(configPath, 'utf8'));
  _config = KeeperConfigSchema.parse(raw);
  return _config;
}
