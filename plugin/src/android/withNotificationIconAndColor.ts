import path from 'path';

import type { ConfigPlugin } from '@expo/config-plugins';
import {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
} from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';
import { logger } from '../utils/logger';

export const FIREBASE_NOTIFICATION_ICON_METADATA =
  'com.google.firebase.messaging.default_notification_icon';
export const FIREBASE_NOTIFICATION_COLOR_METADATA =
  'com.google.firebase.messaging.default_notification_color';

/** Fixed name of the drawable the plugin copies a local icon image to. */
export const NOTIFICATION_ICON_ASSET = 'cio_notification_icon';
/** Fixed name of the color resource the plugin writes a hex color to. */
export const NOTIFICATION_COLOR_RESOURCE = 'cio_notification_color';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Image formats the Android resource compiler accepts as drawables. Anything else (an `.svg`, say)
 * copies fine and only fails later inside AAPT with an obscure error, so unsupported extensions
 * are rejected up front.
 */
export const SUPPORTED_ICON_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg'];

/**
 * Adds a metadata entry referencing an Android resource to the manifest if it doesn't already
 * exist. The Firebase notification defaults are resource references (`android:resource`), unlike
 * the channel metadata which carries plain values (`android:value`).
 *
 * Returns whether the entry references `resource` after the call. An entry the app already
 * declares (manually, or via another plugin) always wins so the plugin composes with existing
 * config — but on bare or `prebuild --no-clean` projects that silently pins the old value when the
 * configured one changes, so a differing existing entry is logged.
 */
export const addResourceMetadataIfNotExists = (
  application: ManifestApplication,
  name: string,
  resource: string
): boolean => {
  if (!application['meta-data']) {
    application['meta-data'] = [];
  }

  const existing = application['meta-data'].find(
    (metadata) => metadata.$['android:name'] === name
  );

  if (existing) {
    const matches = existing.$['android:resource'] === resource;
    if (!matches) {
      logger.warn(
        `[customerio-expo-plugin] AndroidManifest.xml already declares ${name} (${existing.$['android:resource']}); keeping the existing entry. Remove it or run a clean prebuild to apply the configured value.`
      );
    }
    return matches;
  }

  application['meta-data'].push({
    $: {
      'android:name': name,
      'android:resource': resource,
    },
  });
  return true;
};

/**
 * Resolve the configured notification color to the resource the manifest should reference, plus
 * the value to write into colors.xml when the color is a hex literal rather than a reference to a
 * resource the app already defines.
 *
 * Throws on a malformed value so a typo fails prebuild with a clear message instead of failing the
 * Android resource build with an obscure one.
 */
export function resolveNotificationColor(color: string): {
  resource: string;
  value?: string;
} {
  if (color.startsWith('@color/')) {
    return { resource: color };
  }

  if (!HEX_COLOR.test(color)) {
    throw new Error(
      `[customerio-expo-plugin] android.pushNotification.color must be a "#RRGGBB" or "#AARRGGBB" hex color or a "@color/..." resource reference, got "${color}".`
    );
  }

  return { resource: `@color/${NOTIFICATION_COLOR_RESOURCE}`, value: color };
}

/**
 * Resolve the configured notification icon to the drawable the manifest should reference, plus the
 * local file to copy into the drawable resources when the icon is an image path rather than a
 * reference to a drawable the app already defines.
 *
 * Returns null when the configured file doesn't exist or isn't a format AAPT accepts, in which
 * case the caller must skip the manifest entry too, because meta-data pointing at a drawable that
 * was never created fails the Android resource build.
 */
export function resolveNotificationIcon(
  icon: string,
  projectRoot: string
): { resource: string; sourcePath?: string } | null {
  if (icon.startsWith('@drawable/')) {
    return { resource: icon };
  }

  const extension = path.extname(icon).toLowerCase();
  if (extension && !SUPPORTED_ICON_EXTENSIONS.includes(extension)) {
    logger.warn(
      `[customerio-expo-plugin] android.pushNotification.icon "${icon}" has an unsupported extension; the Android resource compiler accepts ${SUPPORTED_ICON_EXTENSIONS.join(', ')}. Push notifications will use the default (grey) icon.`
    );
    return null;
  }

  const absolute = path.isAbsolute(icon)
    ? icon
    : path.resolve(projectRoot, icon);
  if (!FileManagement.exists(absolute)) {
    logger.warn(
      `[customerio-expo-plugin] android.pushNotification.icon "${icon}" was not found at ${absolute}. Push notifications will use the default (grey) icon.`
    );
    return null;
  }

  return {
    resource: `@drawable/${NOTIFICATION_ICON_ASSET}`,
    sourcePath: absolute,
  };
}

/**
 * Copy the icon image into `android/app/src/main/res/drawable`, where the manifest's
 * `android:resource` reference resolves it by name.
 *
 * Returns whether the drawable actually landed: `FileManagement` reports copy failures by logging
 * rather than throwing, and a manifest entry pointing at a drawable that never landed fails the
 * Android resource build, so the caller must skip the meta-data when this returns false. A stale
 * copy with a different extension (a previous prebuild's `.png` after switching to `.webp`) is
 * removed first — two drawables with the same name is a duplicate-resource error.
 */
function installNotificationIcon(
  sourcePath: string,
  androidPath: string
): boolean {
  // Android drawable names must be lowercase alphanumeric/underscore, so the asset name is fixed
  // and only the extension follows the source file.
  const extension = path.extname(sourcePath).toLowerCase() || '.png';
  const drawableDir = `${androidPath}/app/src/main/res/drawable`;
  const destination = `${drawableDir}/${NOTIFICATION_ICON_ASSET}${extension}`;

  FileManagement.mkdir(drawableDir, { recursive: true });
  for (const staleExtension of SUPPORTED_ICON_EXTENSIONS) {
    const stale = `${drawableDir}/${NOTIFICATION_ICON_ASSET}${staleExtension}`;
    if (stale !== destination && FileManagement.exists(stale)) {
      FileManagement.remove(stale);
    }
  }
  FileManagement.copyFile(sourcePath, destination);
  return FileManagement.exists(destination);
}

/**
 * Applies the Android push notification icon and color: the
 * `com.google.firebase.messaging.default_notification_icon` and
 * `com.google.firebase.messaging.default_notification_color` manifest entries the Firebase SDK
 * reads when a push arrives, plus the resources they reference: a local icon image is copied into
 * the drawables, and a hex color is written into colors.xml. Without the icon entry Android tints
 * the app icon into the infamous grey square.
 */
export const withNotificationIconAndColor: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (config, props) => {
  const icon = props.pushNotification?.icon;
  const color = props.pushNotification?.color
    ? resolveNotificationColor(props.pushNotification.color)
    : null;

  // Decided by the manifest mod below: the colors.xml value may only be written when the manifest
  // actually references the plugin-owned color resource, otherwise colors.xml gains an orphaned
  // entry nothing references. Expo only guarantees mod order for `dangerous` and `finalized`; the
  // manifest mod runs before the colors mod in practice, but if the colors mod ever ran first this
  // is still undefined and the write proceeds — degrading to an unused colors.xml entry rather
  // than dropping a configured color.
  let manifestReferencesPluginColor: boolean | undefined;

  config = withAndroidManifest(config, (manifestProps) => {
    const application = manifestProps.modResults.manifest
      .application as ManifestApplication[];

    // Resolved here rather than at plugin-setup time because the existence check needs the
    // project root, which only the mod request carries. Copying inside the same mod keeps the
    // drawable and the manifest entry that references it together: either both happen or neither.
    const resolvedIcon = icon
      ? resolveNotificationIcon(icon, manifestProps.modRequest.projectRoot)
      : null;

    if (resolvedIcon) {
      const installed = resolvedIcon.sourcePath
        ? installNotificationIcon(
            resolvedIcon.sourcePath,
            manifestProps.modRequest.platformProjectRoot
          )
        : true;
      if (installed) {
        addResourceMetadataIfNotExists(
          application[0],
          FIREBASE_NOTIFICATION_ICON_METADATA,
          resolvedIcon.resource
        );
      } else {
        logger.warn(
          `[customerio-expo-plugin] Skipping the ${FIREBASE_NOTIFICATION_ICON_METADATA} manifest entry because the icon could not be copied; referencing a drawable that never landed fails the Android resource build. Push notifications will use the default (grey) icon.`
        );
      }
    }

    if (color) {
      manifestReferencesPluginColor = addResourceMetadataIfNotExists(
        application[0],
        FIREBASE_NOTIFICATION_COLOR_METADATA,
        color.resource
      );
    }

    manifestProps.modResults.manifest.application = application;
    return manifestProps;
  });

  if (color?.value) {
    const colorValue = color.value;
    config = withAndroidColors(config, (colorProps) => {
      if (manifestReferencesPluginColor === false) {
        return colorProps;
      }
      colorProps.modResults = AndroidConfig.Colors.assignColorValue(
        colorProps.modResults,
        { name: NOTIFICATION_COLOR_RESOURCE, value: colorValue }
      );
      return colorProps;
    });
  }

  return config;
};
