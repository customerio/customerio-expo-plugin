import path from 'path';

import type { LiveNotificationBranding } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { FileManagement } from './fileManagement';
import {
  isRemoteLogo,
  LIVE_NOTIFICATION_LOGO_ASSET,
} from './patchLiveNotificationCode';

/**
 * The branding logo a customer points at with a local path has to become a real native asset on
 * each platform: an Android drawable, and an image set inside the generated iOS widget's asset
 * catalog. The generated code references it by the shared name
 * {@link LIVE_NOTIFICATION_LOGO_ASSET}, so without these copies the logo silently renders as
 * nothing.
 *
 * A remote URL is skipped here — Android downloads it at render time, and iOS can't use it at all
 * because the widget is compiled ahead of time.
 */

/** Resolve the configured logo to an absolute path, or null when it isn't a usable local file. */
function resolveLocalLogo(
  branding: LiveNotificationBranding | undefined,
  projectRoot: string
): string | null {
  const logo = branding?.logo;
  if (!logo || isRemoteLogo(logo)) {
    return null;
  }

  const absolute = path.isAbsolute(logo) ? logo : path.resolve(projectRoot, logo);
  if (!FileManagement.exists(absolute)) {
    logger.warn(
      `[customerio-expo-plugin] liveNotifications.branding.logo "${logo}" was not found at ${absolute}. Live Notifications will render without a logo.`
    );
    return null;
  }

  return absolute;
}

/**
 * Copy the logo into `android/app/src/main/res/drawable`, where the generated initializer resolves
 * it by name at runtime via `Resources.getIdentifier`.
 */
export function installAndroidLiveNotificationLogo(
  branding: LiveNotificationBranding | undefined,
  androidPath: string,
  projectRoot: string
): void {
  const source = resolveLocalLogo(branding, projectRoot);
  if (!source) return;

  // Android drawable names must be lowercase alphanumeric/underscore, so the asset name is fixed
  // and only the extension follows the source file.
  const extension = path.extname(source).toLowerCase() || '.png';
  const drawableDir = `${androidPath}/app/src/main/res/drawable`;
  const destination = `${drawableDir}/${LIVE_NOTIFICATION_LOGO_ASSET}${extension}`;

  try {
    FileManagement.mkdir(drawableDir, { recursive: true });
    FileManagement.copyFile(source, destination);
  } catch (error: unknown) {
    logger.error(
      `[customerio-expo-plugin] Failed to copy the Live Notifications logo to ${destination}: ${String(error)}`
    );
  }
}

/**
 * Build `Assets.xcassets` inside the widget target containing the logo image set, and return the
 * catalog's path so the caller can register it as a resource on the widget target. Returns null
 * when there is no local logo to install.
 */
export function installIosLiveNotificationLogo(
  branding: LiveNotificationBranding | undefined,
  widgetPath: string,
  projectRoot: string
): string | null {
  const source = resolveLocalLogo(branding, projectRoot);
  if (!source) return null;

  const filename = path.basename(source);
  const catalogPath = `${widgetPath}/Assets.xcassets`;
  const imageSetPath = `${catalogPath}/${LIVE_NOTIFICATION_LOGO_ASSET}.imageset`;

  try {
    FileManagement.mkdir(imageSetPath, { recursive: true });
    FileManagement.copyFile(source, `${imageSetPath}/${filename}`);
    FileManagement.writeFile(
      `${catalogPath}/Contents.json`,
      `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`
    );
    // A single universal image: the source is used at every scale rather than requiring the
    // customer to supply @2x/@3x variants for a logo the templates render small.
    FileManagement.writeFile(
      `${imageSetPath}/Contents.json`,
      `${JSON.stringify(
        {
          images: [{ filename, idiom: 'universal', scale: '1x' }],
          info: { author: 'xcode', version: 1 },
        },
        null,
        2
      )}\n`
    );
  } catch (error: unknown) {
    logger.error(
      `[customerio-expo-plugin] Failed to create the Live Notifications asset catalog at ${catalogPath}: ${String(error)}`
    );
    return null;
  }

  return catalogPath;
}
