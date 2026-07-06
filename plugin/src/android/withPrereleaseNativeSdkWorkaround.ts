import { withProjectBuildGradle as withExpoProjectBuildGradle } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';

import { injectPrereleaseProjectBuildGradle } from '../helpers/utils/prereleaseNativeSdk';

/**
 * TEMP (pre-release native SDKs). Adds the Sonatype snapshots repo plus the SNAPSHOT version of
 * the branch configured in prereleaseNativeSdk.ts, so the sample app can resolve native SDK code
 * that isn't on Maven Central yet. Revert together with the iOS counterpart and the
 * customerio-reactnative git dependency once the native SDK ships.
 */
export function withPrereleaseNativeSdkWorkaround(config: ExpoConfig): ExpoConfig {
  return withExpoProjectBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = injectPrereleaseProjectBuildGradle(
      gradleConfig.modResults.contents
    );
    return gradleConfig;
  });
}
