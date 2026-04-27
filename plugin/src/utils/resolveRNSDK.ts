import fs from 'fs';
import path from 'path';

const RN_SDK_PACKAGE = 'customerio-reactnative';

export type ResolvedRNSDK = {
  // Absolute path to the package directory.
  packageDir: string;
  // Absolute path to package.json inside that directory.
  packageJsonPath: string;
};

// Resolves the customerio-reactnative SDK location starting from `fromDir`.
//
// Probe-then-fallback so the result agrees with React Native autolinking
// across npm flat, pnpm, and yarn-workspace layouts:
//   1. `fromDir/node_modules/customerio-reactnative/package.json` — preferred.
//      Works for npm flat, pnpm (the symlinked path; we never realpath it),
//      and yarn workspaces with leaf node_modules. Matches what RN
//      autolinking emits for its pod entry, so CocoaPods sees one
//      consistent :path.
//   2. `resolve-from` walking up from `fromDir` — only used when (1) misses.
//      Handles yarn classic workspaces where the dep is hoisted to a parent
//      node_modules. yarn classic has no symlinks, so the realpath is fine.
//
// Returns null if neither finds the package.
export function tryResolveRNSDK(fromDir: string): ResolvedRNSDK | null {
  const directPkgJson = path.join(
    fromDir,
    'node_modules',
    RN_SDK_PACKAGE,
    'package.json'
  );
  if (fs.existsSync(directPkgJson)) {
    return {
      packageDir: path.dirname(directPkgJson),
      packageJsonPath: directPkgJson,
    };
  }

  const resolveFrom = require('resolve-from');
  const fallbackPkgJson = resolveFrom.silent(
    fromDir,
    `${RN_SDK_PACKAGE}/package.json`
  );
  if (fallbackPkgJson) {
    return {
      packageDir: path.dirname(fallbackPkgJson),
      packageJsonPath: fallbackPkgJson,
    };
  }

  return null;
}

// Same as tryResolveRNSDK but throws a clear error when the package is missing.
export function resolveRNSDK(fromDir: string): ResolvedRNSDK {
  const resolved = tryResolveRNSDK(fromDir);
  if (!resolved) {
    throw new Error(
      `${RN_SDK_PACKAGE} was not found relative to ${fromDir}. ` +
      `Ensure it is installed in your project (or in a parent workspace's node_modules).`
    );
  }
  return resolved;
}
