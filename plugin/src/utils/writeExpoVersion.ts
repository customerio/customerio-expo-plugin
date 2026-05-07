import fs from 'fs';
import type { ConfigPlugin } from '@expo/config-plugins';

import { logger } from './logger';
import { getPluginVersion } from './plugin';
import { tryResolveRNSDK } from './resolveRNSDK';

// Writes the plugin's version into customerio-reactnative/package.json under
// the `expoVersion` key. The RN SDK reads this at runtime (customerio-cdp.ts)
// to set its User-Agent `packageSource` to "Expo" instead of "ReactNative".
//
// We rely on the postinstall hook (postInstallHelper.js) for the same write
// at install time, but call this from the plugin entry as a fallback for
// installs where postinstall does not run cleanly — most notably pnpm
// monorepos and any CI that uses --ignore-scripts.
//
// The write is idempotent: we no-op when the value is already correct.
export function writeExpoVersion(projectRoot: string): void {
  let resolved;
  try {
    resolved = tryResolveRNSDK(projectRoot);
  } catch (error) {
    logger.warn(
      `Could not locate customerio-reactnative to write expoVersion. ` +
      `User-Agent attribution may be incorrect. Original error: ${error}`
    );
    return;
  }

  if (!resolved) {
    return;
  }

  try {
    const pluginVersion = getPluginVersion();
    const pkg = JSON.parse(fs.readFileSync(resolved.packageJsonPath, 'utf8'));
    if (pkg.expoVersion === pluginVersion) {
      return;
    }
    pkg.expoVersion = pluginVersion;
    fs.writeFileSync(
      resolved.packageJsonPath,
      JSON.stringify(pkg, null, 2)
    );
  } catch (error) {
    logger.warn(
      `Failed to write expoVersion into ${resolved.packageJsonPath}. ` +
      `User-Agent attribution may be incorrect. Original error: ${error}`
    );
  }
}

export const withExpoVersion: ConfigPlugin = (config) => {
  // _internal.projectRoot is set by Expo when running through prebuild;
  // fall back to process.cwd() for any path that calls the plugin in
  // a non-prebuild context.
  const projectRoot =
    (config as unknown as { _internal?: { projectRoot?: string } })._internal?.projectRoot ||
    process.cwd();
  writeExpoVersion(projectRoot);
  return config;
};
