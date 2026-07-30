import path from 'path';

import type {
  CustomerIOPluginLiveNotificationsOptions,
  LiveNotificationsSDKConfig,
} from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { FileManagement } from './fileManagement';

/**
 * The Android counterpart to `liveNotificationCustomWidget`: a custom live notification is Kotlin the
 * app writes and Customer.io registers. The plugin copies the configured file(s) into the app's
 * source tree and instantiates the named `CustomerIOLiveNotificationsCallback` where the renderer is
 * registered.
 *
 * Android has no built-in template for a custom type, so without this the type is allowlisted — it
 * starts, reports, and the backend can push updates to it — but the SDK draws nothing and logs
 * "no built-in template and createLiveNotification returned null".
 *
 * Best-effort in the same way the widget and the branding logo are: anything misconfigured warns and
 * is skipped rather than failing prebuild, because a half-wired renderer fails deep in the Gradle
 * build where it is far harder to diagnose.
 */

/** A custom renderer resolved against the project on disk, ready to copy into the app. */
export type ResolvedCustomRenderer = {
  /** Absolute paths of the Kotlin files to copy, in configured order. */
  sourceFiles: string[];
  /** Kotlin package each file declares, parallel to [sourceFiles] — it decides where each lands. */
  packages: string[];
  /** The `CustomerIOLiveNotificationsCallback` class to instantiate. */
  className: string;
  /** Package [className] lives in, so callers can import it. */
  classPackage: string;
};

export type ResolveCustomRendererOptions = {
  /** SDK config, read only for `customType` — present only on the auto-initialization path. */
  liveNotifications: LiveNotificationsSDKConfig | undefined;
  /** Build-time options carrying `customRenderer`, available on either initialization path. */
  buildOptions: CustomerIOPluginLiveNotificationsOptions | undefined;
  /** Project root the configured relative paths resolve against. */
  projectRoot: string;
  /**
   * Suppress the warnings. Resolution runs from two mods — the one that copies the files and the one
   * that generates the code referencing them — and both must reach the same verdict, so they call
   * the same function rather than a looser variant. Only the copying mod reports, so a misconfigured
   * renderer is diagnosed once.
   */
  silent?: boolean;
};

const TAG = '[customerio-expo-plugin]';
const SKIPPED = 'No custom live notification will be rendered on Android.';

/** `package com.example.app` — Kotlin allows no semicolon, and the file may open with comments. */
const PACKAGE_REGEX = /^\s*package\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;?\s*$/m;

/**
 * Resolve `liveNotifications.customRenderer` to the files to copy and the class to instantiate, or
 * null when there is nothing usable to render with.
 */
export function resolveCustomLiveNotificationRenderer(
  options: ResolveCustomRendererOptions
): ResolvedCustomRenderer | null {
  const { liveNotifications, buildOptions, projectRoot, silent = false } = options;
  const warn = (message: string) => {
    if (!silent) logger.warn(message);
  };
  const customType = liveNotifications?.customType?.trim();
  const customRenderer = buildOptions?.customRenderer;

  if (!customRenderer) {
    if (customType) {
      warn(
        `${TAG} config.liveNotifications.customType "${customType}" is set without the top-level ` +
          `liveNotifications.customRenderer, so Android has nothing to draw it with. The activity will ` +
          `start and report, and the backend can push updates to it, but no notification appears. ` +
          `Point customRenderer.sourceFile at your Kotlin file and set customRenderer.className.`
      );
    }
    return null;
  }

  const className = customRenderer.className?.trim();
  if (!className) {
    warn(
      `${TAG} liveNotifications.customRenderer.className is required — the plugin never parses Kotlin, ` +
        `so it cannot infer which class to register. ${SKIPPED}`
    );
    return null;
  }

  const configured = (
    Array.isArray(customRenderer.sourceFile)
      ? customRenderer.sourceFile
      : [customRenderer.sourceFile]
  ).filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');

  if (configured.length === 0) {
    warn(
      `${TAG} liveNotifications.customRenderer.sourceFile is required and must be a path to a .kt file. ${SKIPPED}`
    );
    return null;
  }

  const sourceFiles: string[] = [];
  const packages: string[] = [];
  let classPackage: string | undefined;

  for (const entry of configured) {
    const configuredPath = entry.trim();

    if (path.extname(configuredPath).toLowerCase() !== '.kt') {
      warn(
        `${TAG} liveNotifications.customRenderer.sourceFile "${configuredPath}" is not a .kt file. ${SKIPPED}`
      );
      return null;
    }

    const absolute = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(projectRoot, configuredPath);
    if (!FileManagement.exists(absolute)) {
      warn(
        `${TAG} liveNotifications.customRenderer.sourceFile "${configuredPath}" was not found at ${absolute}. ${SKIPPED}`
      );
      return null;
    }

    const contents = FileManagement.readFile(absolute);
    const declaredPackage = contents.match(PACKAGE_REGEX)?.[1];
    if (!declaredPackage) {
      // Unlike the iOS widget, these are not flattened into one plugin-owned directory: Kotlin
      // resolves a class by its package, so the file has to declare one to be placed at all.
      warn(
        `${TAG} liveNotifications.customRenderer.sourceFile "${configuredPath}" declares no Kotlin package. ` +
          `Add one (e.g. \`package com.myapp.livenotifications\`) so the plugin knows where to copy it and ` +
          `how to import ${className}. ${SKIPPED}`
      );
      return null;
    }

    // The declaring file decides the import, so a multi-file renderer can keep helpers elsewhere.
    if (new RegExp(`\\bclass\\s+${className}\\b`).test(contents)) {
      classPackage = declaredPackage;
    }

    sourceFiles.push(absolute);
    packages.push(declaredPackage);
  }

  if (!classPackage) {
    // Warn rather than skip, matching the widget's treatment of a missing struct: the class may be
    // declared in a way this crude check misses, and being wrong here costs a compile error the
    // developer can read, not a silently broken activity.
    warn(
      `${TAG} liveNotifications.customRenderer.className "${className}" was not found in any configured ` +
        `sourceFile. Assuming it lives in "${packages[0]}"; if the generated code fails to compile, that ` +
        `is why.`
    );
    classPackage = packages[0];
  }

  return { sourceFiles, packages, className, classPackage };
}

/**
 * Copy the resolved files into the Android source tree, each under the package it declares.
 *
 * Returns the number of files installed. Failures are logged and skipped per file rather than
 * thrown: prebuild has already generated the rest of the project by this point.
 */
export function installAndroidCustomLiveNotificationRenderer(
  renderer: ResolvedCustomRenderer,
  androidPath: string
): number {
  let installed = 0;

  renderer.sourceFiles.forEach((source, index) => {
    const packagePath = renderer.packages[index].replace(/\./g, '/');
    const destinationDir = path.join(androidPath, 'app/src/main/java', packagePath);
    const destination = path.join(destinationDir, path.basename(source));

    try {
      FileManagement.mkdir(destinationDir, { recursive: true });
      FileManagement.copyFile(source, destination);
      installed += 1;
    } catch (error: unknown) {
      logger.error(
        `${TAG} Failed to copy the custom live notification renderer to ${destination}: ${String(error)}`
      );
    }
  });

  return installed;
}
