import { withDangerousMod } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const NATIVE_INTENT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

export function hasExpoRouterNativeIntent(projectRoot: string): boolean {
  return ['app', path.join('src', 'app')].some((appRoot) =>
    NATIVE_INTENT_EXTENSIONS.some((extension) => {
      const nativeIntentPath = path.join(
        projectRoot,
        appRoot,
        `+native-intent.${extension}`
      );
      if (!fs.existsSync(nativeIntentPath)) return false;

      return /\bCustomerIO\s*\.\s*liveActivities\s*\.\s*handleWidgetUrl\s*\(/.test(
        fs.readFileSync(nativeIntentPath, 'utf8')
      );
    })
  );
}

/**
 * Warn when an Expo scene app enables Live Activities without the supported JavaScript URL
 * transformation point. The plugin cannot safely create or merge a customer-owned native-intent
 * file, and non-Router apps may intentionally transform URLs in their own Linking pipeline.
 */
export function withLiveActivityUrlRoutingWarning(
  config: ExpoConfig
): ExpoConfig {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      if (!hasExpoRouterNativeIntent(modConfig.modRequest.projectRoot)) {
        logger.warn(
          'Expo scene apps with Live Activities must process incoming URLs exactly once with ' +
            'CustomerIO.liveActivities.handleWidgetUrl. Expo Router apps should add it to ' +
            'app/+native-intent.tsx; other apps should compose it into their central Linking pipeline.'
        );
      }
      return modConfig;
    },
  ]);
}
