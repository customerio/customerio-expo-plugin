import { withDangerousMod } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const SCENE_DELEGATE_CLASS_REGEX =
  /class\s+SceneDelegate\s*:\s*[^{}]*\bExpoAppSceneDelegate\b[^{}]*\{/;
const REACT_NATIVE_IMPORT = 'import customerio_reactnative';
const LIVE_ACTIVITY_TRANSFORM_MARKER = 'NativeLiveActivities.handleWidgetUrl(';
const CUSTOMER_IO_TRANSFORM_METHOD_REGEX =
  /\n[ \t]*override\s+func\s+transformURL\s*\(\s*_\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*URL\s*\)\s*->\s*URL\?\s*\{\s*NativeLiveActivities\.handleWidgetUrl\(\1\)\s*\}\n?/;

export type SceneDelegateOptions = {
  liveNotificationsEnabled: boolean;
};

/**
 * Adds only Customer.io URL transformation hooks to Expo's generated SceneDelegate subclass.
 * Expo continues to own the scene, window, and React Native startup through ExpoAppSceneDelegate.
 */
export function modifySceneDelegateForCustomerIO(
  contents: string,
  options: SceneDelegateOptions
): string {
  if (!options.liveNotificationsEnabled) {
    return removeCustomerIOURLTransform(contents);
  }

  const sceneDelegateClass = contents.match(SCENE_DELEGATE_CLASS_REGEX);
  if (!sceneDelegateClass) {
    logger.warn(
      'Could not find SceneDelegate inheriting from ExpoAppSceneDelegate; Live Activity URL routing was not added'
    );
    return contents;
  }

  if (contents.includes(LIVE_ACTIVITY_TRANSFORM_MARKER)) {
    return contents;
  }

  let next = contents;
  if (next.includes('func transformURL')) {
    logger.warn(
      'SceneDelegate.transformURL is already owned by another integration; Live Activity URL routing was not added'
    );
    return next;
  }

  next = addSwiftImport(next, REACT_NATIVE_IMPORT);

  const method = `
  override func transformURL(_ url: URL) -> URL? {
    NativeLiveActivities.handleWidgetUrl(url)
  }
`;

  const classMatch = next.match(SCENE_DELEGATE_CLASS_REGEX);
  if (!classMatch) {
    return next;
  }
  const insertAt = (classMatch.index ?? 0) + classMatch[0].length;
  return `${next.slice(0, insertAt)}${method}${next.slice(insertAt)}`;
}

function removeCustomerIOURLTransform(contents: string): string {
  return contents.replace(CUSTOMER_IO_TRANSFORM_METHOD_REGEX, '\n');
}

export function withCIOSceneDelegate(
  config: ExpoConfig,
  options: SceneDelegateOptions
): ExpoConfig {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectName = modConfig.modRequest.projectName;
      if (!projectName) {
        logger.warn('Project name is undefined, cannot update SceneDelegate');
        return modConfig;
      }

      const sceneDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        projectName,
        'SceneDelegate.swift'
      );
      if (!fs.existsSync(sceneDelegatePath)) {
        return modConfig;
      }

      const contents = fs.readFileSync(sceneDelegatePath, 'utf8');
      const modified = modifySceneDelegateForCustomerIO(contents, options);
      if (modified !== contents) {
        fs.writeFileSync(sceneDelegatePath, modified);
      }
      return modConfig;
    },
  ]);
}

function addSwiftImport(contents: string, importLine: string): string {
  if (contents.includes(importLine)) {
    return contents;
  }

  const imports = [...contents.matchAll(/^(?:\w+[ \t]+)?import[ \t]+\S+.*$/gm)];
  const lastImport = imports[imports.length - 1];
  if (!lastImport) {
    return `${importLine}\n${contents}`;
  }

  const insertAt = (lastImport.index ?? 0) + lastImport[0].length;
  return `${contents.slice(0, insertAt)}\n${importLine}${contents.slice(
    insertAt
  )}`;
}
