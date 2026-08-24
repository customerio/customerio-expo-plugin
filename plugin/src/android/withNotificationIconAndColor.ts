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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Adds a metadata entry referencing an Android resource to the manifest if it doesn't already
 * exist. The Firebase notification defaults are resource references (`android:resource`), unlike
 * the channel metadata which carries plain values (`android:value`).
 */
export const addResourceMetadataIfNotExists = (
  application: ManifestApplication,
  name: string,
  resource: string
): void => {
  if (!application['meta-data']) {
    application['meta-data'] = [];
  }

  const hasMetadata = application['meta-data'].some(
    (metadata) => metadata.$['android:name'] === name
  );

  if (!hasMetadata) {
    application['meta-data'].push({
      $: {
        'android:name': name,
        'android:resource': resource,
      },
    });
  }
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
      `[customerio-expo-plugin] android.pushNotification.color must be a "#RRGGBB" hex color or a "@color/..." resource reference, got "${color}".`
    );
  }

  return { resource: `@color/${NOTIFICATION_COLOR_RESOURCE}`, value: color };
}

/**
 * Resolve the configured notification icon to the drawable the manifest should reference, plus the
 * local file to copy into the drawable resources when the icon is an image path rather than a
 * reference to a drawable the app already defines.
 *
 * Returns null when the configured file doesn't exist, in which case the caller must skip the
 * manifest entry too, because meta-data pointing at a drawable that was never created fails the
 * Android resource build.
 */
export function resolveNotificationIcon(
  icon: string,
  projectRoot: string
): { resource: string; sourcePath?: string } | null {
  if (icon.startsWith('@drawable/')) {
    return { resource: icon };
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
 */
function installNotificationIcon(
  sourcePath: string,
  androidPath: string
): void {
  // Android drawable names must be lowercase alphanumeric/underscore, so the asset name is fixed
  // and only the extension follows the source file.
  const extension = path.extname(sourcePath).toLowerCase() || '.png';
  const drawableDir = `${androidPath}/app/src/main/res/drawable`;
  const destination = `${drawableDir}/${NOTIFICATION_ICON_ASSET}${extension}`;

  try {
    FileManagement.mkdir(drawableDir, { recursive: true });
    FileManagement.copyFile(sourcePath, destination);
  } catch (error: unknown) {
    logger.error(
      `[customerio-expo-plugin] Failed to copy the notification icon to ${destination}: ${String(error)}`
    );
  }
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

  if (color?.value) {
    const colorValue = color.value;
    config = withAndroidColors(config, (colorProps) => {
      colorProps.modResults = AndroidConfig.Colors.assignColorValue(
        colorProps.modResults,
        { name: NOTIFICATION_COLOR_RESOURCE, value: colorValue }
      );
      return colorProps;
    });
  }

  return withAndroidManifest(config, (manifestProps) => {
    const application = manifestProps.modResults.manifest
      .application as ManifestApplication[];

    // Resolved here rather than at plugin-setup time because the existence check needs the
    // project root, which only the mod request carries. Copying inside the same mod keeps the
    // drawable and the manifest entry that references it together: either both happen or neither.
    const resolvedIcon = icon
      ? resolveNotificationIcon(icon, manifestProps.modRequest.projectRoot)
      : null;

    if (resolvedIcon) {
      if (resolvedIcon.sourcePath) {
        installNotificationIcon(
          resolvedIcon.sourcePath,
          manifestProps.modRequest.platformProjectRoot
        );
      }
      addResourceMetadataIfNotExists(
        application[0],
        FIREBASE_NOTIFICATION_ICON_METADATA,
        resolvedIcon.resource
      );
    }

    if (color) {
      addResourceMetadataIfNotExists(
        application[0],
        FIREBASE_NOTIFICATION_COLOR_METADATA,
        color.resource
      );
    }

    manifestProps.modResults.manifest.application = application;
    return manifestProps;
  });
};
