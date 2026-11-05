import { PLATFORM, type Platform } from '../constants/common';

/**
 * The React Native SDK's native silent push callback. It hands the push to the JavaScript handler
 * registered with `CustomerIO.pushMessaging.onBackgroundPush`, starting JavaScript in the background
 * when the push started the app.
 */
export const ANDROID_BACKGROUND_PUSH_CALLBACK = {
  importLine: 'import RN_BACKGROUND_PUSH_CALLBACK_IMPORT',
  expression: 'RN_BACKGROUND_PUSH_CALLBACK_EXPRESSION',
};

/**
 * Replace `{{BACKGROUND_PUSH_MODULE_IMPORT}}` and `{{BACKGROUND_PUSH_MODULE_INIT}}` in the generated
 * SDK initializer.
 *
 * Android only: the callback has to be on the push module config when the SDK initializes in
 * `Application.onCreate`, because Firebase can start the app just to deliver a silent push and
 * JavaScript isn't running then. iOS hands silent pushes over from the AppDelegate instead, so its
 * initializer has no placeholders and is returned unchanged.
 *
 * Runs before the Live Notification placeholders: when both are unused, removing these lines first
 * puts the builder chain back in the shape that collapses onto one line, so apps that don't opt in
 * get byte-identical output.
 */
export function patchBackgroundPushPlaceholders(
  content: string,
  platform: Platform,
  enabled = false
): string {
  if (platform !== PLATFORM.ANDROID || !enabled) {
    return content
      .replace(/\n\{\{BACKGROUND_PUSH_MODULE_IMPORT\}\}(?=\n)/g, '')
      .replace(/\n[ \t]*\{\{BACKGROUND_PUSH_MODULE_INIT\}\}(?=\n)/g, '');
  }

  return content
    .replace(
      /\{\{BACKGROUND_PUSH_MODULE_IMPORT\}\}/g,
      ANDROID_BACKGROUND_PUSH_CALLBACK.importLine
    )
    .replace(
      /\{\{BACKGROUND_PUSH_MODULE_INIT\}\}/g,
      `.setBackgroundPushCallback(${ANDROID_BACKGROUND_PUSH_CALLBACK.expression})`
    );
}
