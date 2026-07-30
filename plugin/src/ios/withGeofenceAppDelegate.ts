import type { ConfigPlugin } from '@expo/config-plugins';
import { withAppDelegate, withXcodeProject } from '@expo/config-plugins';
import path from 'path';

import { getIosNativeFilesPath } from '../utils/plugin';
import { copyFileToXcode, getOrCreateCustomerIOGroup } from '../utils/xcode';
import { logger } from '../utils/logger';

const HANDLER_CLASS = 'CioGeofenceAppDelegateHandler';
const HANDLER_FILE = `${HANDLER_CLASS}.swift`;
const HANDLER_PROPERTY = `let cioGeofenceHandler = ${HANDLER_CLASS}()`;
const HANDLER_CALL = `cioGeofenceHandler.application(application, didFinishLaunchingWithOptions: launchOptions)`;

/**
 * Adds the `let cioGeofenceHandler = CioGeofenceAppDelegateHandler()` property to the AppDelegate
 * class. Idempotent. The handler type ships with the plugin and lives in the app target, so no import
 * is needed here.
 */
const addHandlerProperty = (contents: string): string => {
  if (contents.includes(HANDLER_PROPERTY)) {
    return contents;
  }

  const classRegex = /class\s+AppDelegate\s*:\s*[^\n{]*\{/;
  const match = contents.match(classRegex);
  if (!match) {
    logger.warn('Could not find AppDelegate class declaration; skipping geofence handler property');
    return contents;
  }

  const insertPosition = (match.index ?? 0) + match[0].length;
  return (
    contents.substring(0, insertPosition) +
    `\n  ${HANDLER_PROPERTY}\n` +
    contents.substring(insertPosition)
  );
};

/**
 * Injects the single geofence handler call at the top of didFinishLaunchingWithOptions, before
 * React Native is started (the Expo template calls `factory.startReactNative(...)` later in this
 * method). Idempotent.
 */
const addHandlerCall = (contents: string): string => {
  if (contents.includes(HANDLER_CALL)) {
    return contents;
  }

  const methodRegex =
    /(func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;
  const match = contents.match(methodRegex);
  if (!match) {
    logger.warn(
      'Could not find didFinishLaunchingWithOptions in AppDelegate.swift; skipping geofence handler call'
    );
    return contents;
  }

  const insertPosition = (match.index ?? 0) + match[0].length;
  return (
    contents.substring(0, insertPosition) +
    `\n    ${HANDLER_CALL}\n` +
    contents.substring(insertPosition)
  );
};

/**
 * Pure string transform: adds the geofence handler property and its didFinishLaunchingWithOptions
 * call to the Swift AppDelegate. Each step is independently idempotent.
 *
 * Exported for tests.
 */
export function modifyAppDelegateForGeofenceBootstrap(contents: string): string {
  return addHandlerCall(addHandlerProperty(contents));
}

/** Copies CioGeofenceAppDelegateHandler.swift into the app target and registers it with Xcode. */
const withGeofenceHandlerFile: ConfigPlugin = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const projectName = xcodeConfig.modRequest.projectName || '';
    if (!projectName) {
      logger.warn('Project name is undefined; cannot copy CioGeofenceAppDelegateHandler.swift');
      return xcodeConfig;
    }

    const iosProjectRoot = path.join(xcodeConfig.modRequest.projectRoot, 'ios');
    const group = getOrCreateCustomerIOGroup(xcodeConfig.modResults, projectName);
    copyFileToXcode({
      xcodeProject: xcodeConfig.modResults,
      iosProjectRoot,
      projectName,
      sourceFilePath: path.join(getIosNativeFilesPath(), HANDLER_FILE),
      targetFileName: HANDLER_FILE,
      transform: (content) => content,
      customerIOGroup: group,
    });
    return xcodeConfig;
  });

/**
 * Wires geofence cold-wake background delivery: ships CioGeofenceAppDelegateHandler.swift and adds a
 * single call to it from the Swift AppDelegate. Runs whenever geofence is enabled, independent of
 * push/auto-init. Geofence is gated to Swift projects (Expo SDK 53+) at the plugin entry point.
 */
export const withGeofenceAppDelegate: ConfigPlugin = (config) => {
  config = withGeofenceHandlerFile(config);
  return withAppDelegate(config, (appDelegateConfig) => {
    appDelegateConfig.modResults.contents = modifyAppDelegateForGeofenceBootstrap(
      appDelegateConfig.modResults.contents
    );
    return appDelegateConfig;
  });
};
