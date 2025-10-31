import { withProjectBuildGradle as withExpoProjectBuildGradle } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { isExpoVersion53OrLower } from '../ios/utils';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

/**
 * Determines if the androidx dependency fix should be applied based on config and Expo version.
 * The fix disables Android 16 support by downgrading androidx dependencies.
 * @param config The Expo config
 * @param androidOptions The Android plugin options
 * @returns true if the fix should be applied (Android 16 disabled)
 */
function shouldDisableAndroid16Support(
  config: ExpoConfig,
  androidOptions?: CustomerIOPluginOptionsAndroid
): boolean {
  // If user explicitly sets the option, respect their choice
  if (androidOptions?.disableAndroid16Support !== undefined) {
    return androidOptions.disableAndroid16Support;
  }

  // Auto-detect: Disable Android 16 for Expo SDK 53 or lower, enable for 54+
  return isExpoVersion53OrLower(config);
}

/**
 * Adds dependency resolution strategy to force specific androidx versions.
 * This disables Android 16 support for apps using Expo SDK 53 or older gradle versions.
 *
 * The fix prevents newer androidx versions that require Android API 36 and AGP 8.9.1+
 * from being pulled in. Expo SDK 53 uses Android API 35 and AGP 8.8.2, so we force
 * compatible versions.
 *
 * Expo SDK 54+ should support newer gradle versions and won't need this fix.
 */
export function withProjectBuildGradle(
  config: ExpoConfig,
  androidOptions?: CustomerIOPluginOptionsAndroid
): ExpoConfig {
  return withExpoProjectBuildGradle(config, (config) => {
    const { modResults } = config;

    // Check if Android 16 support should be disabled
    if (!shouldDisableAndroid16Support(config, androidOptions)) {
      return config;
    }

    // Skip if already applied
    if (modResults.contents.includes('androidx.core:core-ktx:1.13.1')) {
      return config;
    }

    const resolutionStrategy = `
    configurations.all {
        resolutionStrategy {
            // Disable Android 16 support by forcing older androidx versions
            // Compatible with API 35 and AGP 8.8.2 (prevents API 36/AGP 8.9.1+ requirement)
            force 'androidx.core:core-ktx:1.13.1'
            force 'androidx.lifecycle:lifecycle-process:2.8.7'
        }
    }`;

    // Add resolution strategy inside allprojects block
    modResults.contents = modResults.contents.replace(
      /allprojects\s*\{/,
      `allprojects {${resolutionStrategy}`
    );

    return config;
  });
}
