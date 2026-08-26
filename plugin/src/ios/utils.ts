import type { ExpoConfig } from '@expo/config-types';
import fs from 'fs';
import path from 'path';
import * as semver from 'semver';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

/** Confirm the generated native project actually adopted Expo's scene lifecycle. */
export function hasExpoSceneLifecycle(
  platformProjectRoot?: string,
  projectName?: string | null
): boolean {
  if (!platformProjectRoot || !projectName) return false;

  const projectDirectory = path.join(platformProjectRoot, projectName);
  const sceneDelegatePath = path.join(projectDirectory, 'SceneDelegate.swift');
  const infoPlistPath = path.join(projectDirectory, 'Info.plist');
  if (!fs.existsSync(sceneDelegatePath) || !fs.existsSync(infoPlistPath)) {
    return false;
  }

  const infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
  return (
    infoPlist.includes('<key>UIApplicationSceneManifest</key>') &&
    infoPlist.includes('<key>UISceneDelegateClassName</key>')
  );
}

/** Add imports outside any host-owned conditional import block. */
export function addSwiftImports(
  contents: string,
  imports: string[]
): string {
  const matches = [
    ...contents.matchAll(
      /^(?:(?:@_\w+|\w+)[ \t]+)?import[ \t]+(\S+).*$/gm
    ),
  ];
  const importedModules = new Set(
    matches
      .filter(
        (match) =>
          enclosingConditionalStart(contents, match.index ?? 0) === undefined
      )
      .map((match) => match[1])
  );
  const missing = imports.filter((line) => {
    const moduleName = line.match(/^import[ \t]+(\S+)$/)?.[1];
    return moduleName ? !importedModules.has(moduleName) : true;
  });
  if (missing.length === 0) return contents;

  const lastImport = matches[matches.length - 1];
  if (!lastImport) {
    return `${missing.join('\n')}\n${contents}`;
  }

  const conditionalStart = enclosingConditionalStart(
    contents,
    lastImport.index ?? 0
  );
  if (conditionalStart !== undefined) {
    return `${contents.slice(0, conditionalStart)}${missing.join(
      '\n'
    )}\n${contents.slice(conditionalStart)}`;
  }

  const insertAt = (lastImport.index ?? 0) + lastImport[0].length;
  return `${contents.slice(0, insertAt)}\n${missing.join('\n')}${contents.slice(
    insertAt
  )}`;
}

function enclosingConditionalStart(
  contents: string,
  position: number
): number | undefined {
  const stack: number[] = [];
  const prefix = contents.slice(0, position);
  for (const directive of prefix.matchAll(/^[ \t]*#(if|endif)\b.*$/gm)) {
    if (directive[1] === 'if') {
      stack.push(directive.index ?? 0);
    } else {
      stack.pop();
    }
  }
  return stack[0];
}

/**
 * Returns true if FCM is configured to be used as push provider
 * @param iosOptions The plugin iOS configuration options
 * @returns true if FCM is configured to be used as push provider
 */
export const isFcmPushProvider = (
  iosOptions?: CustomerIOPluginOptionsIOS
): boolean => {
  return iosOptions?.pushNotification?.provider === 'fcm';
};

/** Checks if Expo SDK version meets minimum version requirement */
function isExpoVersionOrHigher(
  config: ExpoConfig,
  minVersion: string
): boolean {
  const sdkVersion = config.sdkVersion || '';
  // Expo prereleases already use the next SDK's native template. Compare the coerced major version
  // so 58.0.0-beta and 58.0.0-rc projects take the same scene path as the stable SDK.
  const validVersion = semver.coerce(sdkVersion) || semver.valid(sdkVersion);
  if (!validVersion) return false;
  return semver.gte(validVersion, minVersion);
}

/** Returns true if Expo SDK version is >= 53.0.0 */
export const isExpoVersion53OrHigher = (config: ExpoConfig): boolean => {
  return isExpoVersionOrHigher(config, '53.0.0');
};

/** Returns true if Expo uses the generated UIScene lifecycle (SDK >= 58.0.0). */
export const isExpoVersion58OrHigher = (config: ExpoConfig): boolean => {
  return isExpoVersionOrHigher(config, '58.0.0');
};

/** Returns true if Expo SDK version is <= 53.x.x (used for Android 16 compat detection) */
export const isExpoVersion53OrLower = (config: ExpoConfig): boolean => {
  return !isExpoVersionOrHigher(config, '54.0.0');
};
