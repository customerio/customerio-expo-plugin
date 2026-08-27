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

  const sceneDelegate = maskSwiftNonCode(
    fs.readFileSync(sceneDelegatePath, 'utf8')
  );
  const infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
  const sceneDelegateClassName = infoPlist
    .match(
      /<key>UISceneDelegateClassName<\/key>\s*<string>([^<]+)<\/string>/
    )?.[1]
    ?.trim();
  return (
    infoPlist.includes('<key>UIApplicationSceneManifest</key>') &&
    sceneDelegateClassName === '$(PRODUCT_MODULE_NAME).SceneDelegate' &&
    /\bclass\s+SceneDelegate\s*:\s*(?:Expo\.)?ExpoAppSceneDelegate\b/.test(
      sceneDelegate
    )
  );
}

/** Add imports outside any host-owned conditional import block. */
export function addSwiftImports(
  contents: string,
  imports: string[]
): string {
  const executableContents = maskSwiftNonCode(contents);
  const matches = [
    ...executableContents.matchAll(
      /^(?:(?:@_\w+|\w+)[ \t]+)?import[ \t]+(\S+).*$/gm
    ),
  ];
  const importedModules = new Set(
    matches
      .filter(
        (match) =>
          enclosingConditionalStart(executableContents, match.index ?? 0) ===
          undefined
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
    executableContents,
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

/**
 * Replaces Swift comments and string contents with spaces while preserving indexes and line breaks.
 * Presence checks can then distinguish executable generated hooks from non-code text.
 */
export function maskSwiftNonCode(contents: string): string {
  const output = contents.split('');
  let blockDepth = 0;
  let stringDelimiter:
    | { quote: '"' | '"""'; hashCount: number }
    | undefined;
  let index = 0;

  const mask = (start: number, end: number): void => {
    for (let position = start; position < end; position += 1) {
      if (output[position] !== '\n' && output[position] !== '\r') {
        output[position] = ' ';
      }
    }
  };
  const isEscaped = (position: number): boolean => {
    let backslashes = 0;
    for (
      let cursor = position - 1;
      cursor >= 0 && contents[cursor] === '\\';
      cursor -= 1
    ) {
      backslashes += 1;
    }
    return backslashes % 2 === 1;
  };

  while (index < contents.length) {
    if (blockDepth > 0) {
      if (contents.startsWith('/*', index)) {
        blockDepth += 1;
        mask(index, index + 2);
        index += 2;
      } else if (contents.startsWith('*/', index)) {
        blockDepth -= 1;
        mask(index, index + 2);
        index += 2;
      } else {
        mask(index, index + 1);
        index += 1;
      }
      continue;
    }

    if (stringDelimiter) {
      const closingDelimiter = `${stringDelimiter.quote}${'#'.repeat(
        stringDelimiter.hashCount
      )}`;
      if (
        contents.startsWith(closingDelimiter, index) &&
        (stringDelimiter.hashCount > 0 || !isEscaped(index))
      ) {
        mask(index, index + closingDelimiter.length);
        index += closingDelimiter.length;
        stringDelimiter = undefined;
      } else {
        mask(index, index + 1);
        index += 1;
      }
      continue;
    }

    const rawStringStart = contents
      .slice(index)
      .match(/^(#+)("""|")/);
    if (rawStringStart) {
      stringDelimiter = {
        quote: rawStringStart[2] as '"' | '"""',
        hashCount: rawStringStart[1].length,
      };
      mask(index, index + rawStringStart[0].length);
      index += rawStringStart[0].length;
    } else if (contents.startsWith('"""', index)) {
      stringDelimiter = { quote: '"""', hashCount: 0 };
      mask(index, index + 3);
      index += 3;
    } else if (contents[index] === '"') {
      stringDelimiter = { quote: '"', hashCount: 0 };
      mask(index, index + 1);
      index += 1;
    } else if (contents.startsWith('//', index)) {
      const lineEnd = contents.indexOf('\n', index);
      const commentEnd = lineEnd < 0 ? contents.length : lineEnd;
      mask(index, commentEnd);
      index = commentEnd;
    } else if (contents.startsWith('/*', index)) {
      blockDepth = 1;
      mask(index, index + 2);
      index += 2;
    } else {
      index += 1;
    }
  }

  return output.join('');
}

export function enclosingConditionalStart(
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
  const validVersion = semver.valid(sdkVersion) || semver.coerce(sdkVersion);
  if (!validVersion) return false;
  return semver.gte(validVersion, minVersion);
}

/** Returns true if Expo SDK version is >= 53.0.0 */
export const isExpoVersion53OrHigher = (config: ExpoConfig): boolean => {
  return isExpoVersionOrHigher(config, '53.0.0');
};

/** Returns true if Expo uses the generated UIScene lifecycle (SDK >= 58.0.0). */
export const isExpoVersion58OrHigher = (config: ExpoConfig): boolean => {
  // Expo prereleases already use the next SDK's native template. Compare the coerced major version
  // here without changing prerelease behavior for the older version gates above.
  const coercedVersion = semver.coerce(config.sdkVersion || '');
  return coercedVersion
    ? semver.gte(coercedVersion, '58.0.0')
    : false;
};

/** Returns true if Expo SDK version is <= 53.x.x (used for Android 16 compat detection) */
export const isExpoVersion53OrLower = (config: ExpoConfig): boolean => {
  return !isExpoVersionOrHigher(config, '54.0.0');
};
