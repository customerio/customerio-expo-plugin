import path from 'path';

import type {
  CustomerIOPluginLiveNotificationsOptions,
  LiveNotificationsSDKConfig,
} from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { FileManagement } from './fileManagement';

/**
 * A custom Live Activity is SwiftUI the app writes and Customer.io compiles: the plugin copies the
 * configured file(s) into the widget extension it generates and instantiates the named struct in
 * the generated `WidgetBundle`. The app therefore needs no widget target of its own, and no
 * attributes type — the native SDK ships `CIOCustomAttributes` for exactly this.
 *
 * Everything here is best-effort in the same way the branding logo install is: a misconfigured
 * widget warns and is skipped rather than failing prebuild, because the alternative (a
 * half-registered target) is worse than a project without the custom template.
 */

/** A custom widget resolved against the project on disk, ready to copy into the widget target. */
export type ResolvedCustomWidget = {
  /** Absolute paths of the Swift files to compile, in configured order. */
  sourceFiles: string[];
  /** File names those get inside the widget directory — also their Xcode group/build entries. */
  filenames: string[];
  /** Swift `Widget` struct the generated bundle instantiates. */
  structName: string;
};

export type ResolveCustomWidgetOptions = {
  /** SDK config, read only for `customType` — present only on the auto-initialization path. */
  liveNotifications: LiveNotificationsSDKConfig | undefined;
  /** Build-time options carrying `customWidget`, available on either initialization path. */
  buildOptions: CustomerIOPluginLiveNotificationsOptions | undefined;
  /**
   * Whether the app initializes the SDK automatically. Only then does the plugin generate the code
   * that registers `customType`, so only then can a missing `customType` be diagnosed here — a
   * JavaScript-initialized app supplies it at runtime, where the plugin cannot see it.
   */
  autoInitializes: boolean;
  /** Project root the configured relative paths resolve against. */
  projectRoot: string;
  /**
   * File names the plugin writes into the widget directory itself. A copied file must not shadow
   * one of them: the copies land in the same flat directory, so it would overwrite the generated
   * bundle, the target's Info.plist, or the branding asset catalog.
   */
  reservedFilenames: string[];
};

const TAG = '[customerio-expo-plugin]';
const SKIPPED = 'No custom Live Activity template will be rendered.';

/**
 * Resolve `liveNotifications.customWidget` to the files to compile and the struct to instantiate,
 * or null when there is nothing usable to render.
 *
 * Anything structurally wrong (no struct name, a non-Swift path, a file that isn't there, names
 * that would collide once flattened into the widget directory) drops the whole custom template
 * rather than part of it: a widget missing one of its files fails deep in the Xcode build, which is
 * far harder to diagnose than a prebuild warning.
 */
export function resolveCustomLiveActivityWidget(
  options: ResolveCustomWidgetOptions
): ResolvedCustomWidget | null {
  const { liveNotifications, buildOptions, autoInitializes, projectRoot, reservedFilenames } =
    options;
  const customType = liveNotifications?.customType?.trim();
  const customWidget = buildOptions?.customWidget;

  if (!customWidget) {
    if (customType) {
      logger.warn(
        `${TAG} config.liveNotifications.customType "${customType}" is set without the top-level ` +
          `liveNotifications.customWidget, ` +
          `so the generated widget has no SwiftUI to render it with. Point customWidget.sourceFile at your ` +
          `SwiftUI file and set customWidget.structName.`
      );
    }
    return null;
  }

  const structName = customWidget.structName?.trim();
  if (!structName) {
    logger.warn(
      `${TAG} liveNotifications.customWidget.structName is required — the plugin never parses Swift, so it ` +
        `cannot infer which struct to add to the generated WidgetBundle. ${SKIPPED}`
    );
    return null;
  }

  if (!customType && autoInitializes) {
    // Only diagnosable on this path. With automatic initialization the generated code is what
    // registers the identifier, so its absence means the widget draws a type nothing registers.
    // A JavaScript-initialized app passes it to `CustomerIO.initialize` instead, which is correct
    // and invisible here — warning there would fire on a supported setup.
    logger.warn(
      `${TAG} config.liveNotifications.customType is not set, so the generated initializer registers ` +
        `no custom activity type and the widget would draw one nothing starts. Set it to your own ` +
        `reverse-DNS identifier.`
    );
  }

  const configured = (
    Array.isArray(customWidget.sourceFile)
      ? customWidget.sourceFile
      : [customWidget.sourceFile]
  ).filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');

  if (configured.length === 0) {
    logger.warn(
      `${TAG} liveNotifications.customWidget.sourceFile is required and must be a path to a .swift file. ${SKIPPED}`
    );
    return null;
  }

  const sourceFiles: string[] = [];
  const filenames: string[] = [];
  // Case-insensitively: the copies land on a case-insensitive filesystem (APFS by default), so
  // `View.swift` and `view.swift` are the same destination even though the configs differ.
  const taken = new Map(
    reservedFilenames.map((filename) => [filename.toLowerCase(), 'generated by the plugin'])
  );

  for (const entry of configured) {
    const configuredPath = entry.trim();

    if (path.extname(configuredPath).toLowerCase() !== '.swift') {
      logger.warn(
        `${TAG} liveNotifications.customWidget.sourceFile "${configuredPath}" is not a .swift file. ${SKIPPED}`
      );
      return null;
    }

    const absolute = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(projectRoot, configuredPath);
    if (!FileManagement.exists(absolute)) {
      logger.warn(
        `${TAG} liveNotifications.customWidget.sourceFile "${configuredPath}" was not found at ${absolute}. ${SKIPPED}`
      );
      return null;
    }

    const filename = path.basename(absolute);
    const collision = taken.get(filename.toLowerCase());
    if (collision) {
      logger.warn(
        `${TAG} liveNotifications.customWidget.sourceFile "${configuredPath}" would be copied over a file ` +
          `${collision} — every source file is flattened into one widget directory, so "${filename}" has to be ` +
          `unique there. Rename it. ${SKIPPED}`
      );
      return null;
    }

    taken.set(filename.toLowerCase(), 'already copied from another sourceFile entry');
    sourceFiles.push(absolute);
    filenames.push(filename);
  }

  warnWhenStructIsMissing(sourceFiles, structName);

  return { sourceFiles, filenames, structName };
}

/**
 * Copy the resolved files into the widget directory and return the names to register on the widget
 * target. Kept separate from resolution because the generated `WidgetBundle` needs `structName`
 * before the target directory is written.
 */
export function installCustomLiveActivityWidget(
  widget: ResolvedCustomWidget,
  widgetPath: string
): string[] {
  widget.sourceFiles.forEach((source, index) => {
    FileManagement.copyFile(source, `${widgetPath}/${widget.filenames[index]}`);
  });

  return [...widget.filenames];
}

/**
 * A `structName` that matches nothing in the copied files fails at the Xcode build ("cannot find
 * '…' in scope"), long after prebuild. A textual check can't be authoritative — the struct may be
 * declared through a macro or a typealias — so this only warns.
 */
function warnWhenStructIsMissing(sourceFiles: string[], structName: string): void {
  const declaration = new RegExp(`\\bstruct\\s+${escapeForRegExp(structName)}\\b`);
  const declared = sourceFiles.some((source) =>
    declaration.test(FileManagement.readFile(source))
  );

  if (!declared) {
    logger.warn(
      `${TAG} liveNotifications.customWidget.structName "${structName}" was not found in the configured ` +
        `source file(s). The generated WidgetBundle instantiates it, so the widget target will fail to compile ` +
        `unless the name is declared there.`
    );
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
