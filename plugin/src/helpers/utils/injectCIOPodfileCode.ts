import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export type InjectCIOPodfileOptions = {
  /** When true, add the location subspec. When false/omit, use single push subspec only. */
  locationEnabled?: boolean;
  /** When false and locationEnabled, inject only :subspecs => ['location']. When true, use push + location. */
  hasPush?: boolean;
};

/** Builds the host-app pod snippet for the Podfile.
 *
 * Emits a `customerio_reactnative_path` Ruby lambda that resolves the
 * customerio-reactnative path at pod install time using Node's
 * `require.resolve`, with the prebuild-time relative path baked in as a
 * fallback. Each pod line then references the variable instead of a baked
 * path string. This guarantees the path our pod entry uses is identical to
 * whatever path React Native autolinking emits in the same Podfile (both go
 * through Node's resolver at the same moment), avoiding CocoaPods'
 * "multiple dependencies with different sources" error under pnpm/yarn
 * symlinks.
 *
 * Exported for tests.
 */
export function buildHostAppPodSnippet(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
): string {
  const fallbackPath = getRelativePathToRNSDK(iosPath);
  const locationEnabled = options?.locationEnabled === true;
  const hasPush = options?.hasPush !== false;

  const podLine = (() => {
    if (!locationEnabled) {
      const subspec = isFcmPushProvider ? 'fcm' : 'apn';
      return `pod 'customerio-reactnative/${subspec}', :path => customerio_reactnative_path`;
    }
    if (!hasPush) {
      return `pod 'customerio-reactnative', :subspecs => ['location'], :path => customerio_reactnative_path`;
    }
    const pushSubspec = isFcmPushProvider ? 'fcm' : 'apn';
    return `pod 'customerio-reactnative', :subspecs => ['${pushSubspec}', 'location'], :path => customerio_reactnative_path`;
  })();

  return [
    buildResolveSnippet(fallbackPath),
    podLine,
  ].join('\n  ');
}

/** Ruby lambda that resolves customerio-reactnative at pod install time.
 * Shape mirrors the canonical Expo pattern (e.g. `@expo/config-plugins`'s
 * `Maps.ts`) so the path matches what `use_native_modules!` emits.
 * Exported for tests.
 */
export function buildResolveSnippet(fallbackPath: string): string {
  // The fallback string lives literally inside the lambda. Single-quoted to
  // be safe with Ruby (the prebuild-resolved path is always relative and
  // POSIX, no escape concerns in practice).
  return [
    `customerio_reactnative_path = (lambda do`,
    `    out = \`node --print "require.resolve('customerio-reactnative/package.json')" 2>/dev/null\`.strip`,
    `    if $?.success? && !out.empty?`,
    `      Pathname.new(File.dirname(out)).relative_path_from(Pathname.new(__dir__)).to_s`,
    `    else`,
    `      '${fallbackPath}'`,
    `    end`,
    `  end).call`,
  ].join('\n  ');
}

export async function injectCIOPodfileCode(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
) {
  const blockStart = '# --- CustomerIO Host App START ---';
  const blockEnd = '# --- CustomerIO Host App END ---';

  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    // We need to decide what line of code in the Podfile to insert our native code.
    // The "post_install" line is always present in an Expo project Podfile so it's reliable.
    // Find that line in the Podfile and then we will insert our code above that line.
    const lineInPodfileToInjectSnippetBefore = /post_install do \|installer\|/;

    const podLine = buildHostAppPodSnippet(iosPath, isFcmPushProvider, options);

    const snippetToInjectInPodfile = `
${blockStart}
  ${podLine}
${blockEnd}
`.trim();

    FileManagement.write(
      filename,
      injectCodeByRegex(
        podfile,
        lineInPodfileToInjectSnippetBefore,
        snippetToInjectInPodfile
      ).join('\n')
    );
  } else {
    logger.info('CustomerIO Podfile snippets already exists. Skipping...');
  }
}

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
  isFcmPushProvider: boolean
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);

  const blockStart = '# --- CustomerIO Notification START ---';
  const blockEnd = '# --- CustomerIO Notification END ---';

  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    // The NSE target is a separate `target 'NotificationService'` block; the
    // lambda from the host-app block is out of scope here. Emit the same
    // resolver locally so customerio-reactnative-richpush points at the
    // same directory Node resolves at install time, consistent with the
    // host-app pod entry.
    const resolveSnippet = buildResolveSnippet(getRelativePathToRNSDK(iosPath));
    const subspec = isFcmPushProvider ? 'fcm' : 'apn';
    const useFrameworksLine =
      useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : '';

    const snippetToInjectInPodfile = `
${blockStart}
target 'NotificationService' do
  ${useFrameworksLine}
  ${resolveSnippet}
  pod 'customerio-reactnative-richpush/${subspec}', :path => customerio_reactnative_path
end
${blockEnd}
`.trim();

    FileManagement.append(filename, snippetToInjectInPodfile);
  }
}
