import { withDangerousMod } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import {
  addSwiftImports,
  hasExpoSceneLifecycle,
  maskSwiftNonCode,
} from './utils';

const SCENE_DELEGATE_CLASS_REGEX =
  /class\s+SceneDelegate\s*:\s*[^{}]*\bExpoAppSceneDelegate\b[^{}]*\{/;
const REACT_NATIVE_IMPORT = 'import customerio_reactnative';
const TRANSFORM_METHOD_DECLARATION_REGEX =
  /^[ \t]*(?:\w+[ \t]+)*override[ \t]+func[ \t]+transformURL[ \t]*\(/m;
const CUSTOMER_IO_TRANSFORM_METHOD_REGEX =
  /\n[ \t]*override\s+func\s+transformURL\s*\(\s*_\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*URL\s*\)\s*->\s*URL\?\s*\{\s*(?:return\s+)?NativeCustomerIO\.handleLiveActivityWidgetUrl\(\1\)\s*\}\n?/;

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

  const executableContents = maskSwiftNonCode(contents);
  const sceneDelegateClass = executableContents.match(
    SCENE_DELEGATE_CLASS_REGEX
  );
  if (!sceneDelegateClass) {
    logger.warn(
      'Could not find SceneDelegate inheriting from ExpoAppSceneDelegate; Live Activity URL routing was not added'
    );
    return contents;
  }

  if (CUSTOMER_IO_TRANSFORM_METHOD_REGEX.test(executableContents)) {
    return contents;
  }

  let next = contents;
  if (TRANSFORM_METHOD_DECLARATION_REGEX.test(executableContents)) {
    logger.warn(
      'SceneDelegate.transformURL is already owned by another integration; Live Activity URL routing was not added'
    );
    return next;
  }

  next = addSwiftImports(next, [REACT_NATIVE_IMPORT]);

  const method = `
  override func transformURL(_ url: URL) -> URL? {
    NativeCustomerIO.handleLiveActivityWidgetUrl(url)
  }
`;

  const classMatch = maskSwiftNonCode(next).match(SCENE_DELEGATE_CLASS_REGEX);
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

      if (
        !hasExpoSceneLifecycle(
          modConfig.modRequest.platformProjectRoot,
          projectName
        )
      ) {
        if (options.liveNotificationsEnabled) {
          logger.warn(
            'The generated iOS project has not adopted Expo scenes; Live Activity URL routing remains in AppDelegate'
          );
        }
        return modConfig;
      }

      const sceneDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        projectName,
        'SceneDelegate.swift'
      );
      if (!fs.existsSync(sceneDelegatePath)) {
        if (options.liveNotificationsEnabled) {
          logger.warn(
            'Could not find the Expo SceneDelegate; Live Activity URL routing was not added'
          );
        }
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
