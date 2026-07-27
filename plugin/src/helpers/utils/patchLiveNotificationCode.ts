import {
  LIVE_NOTIFICATION_TYPES,
  type LiveNotificationBranding,
  type LiveNotificationsSDKConfig,
} from '../../types/cio-types';
import { PLATFORM, type Platform } from '../constants/common';

/** Drawable/asset name the plugin gives a copied branding logo on both platforms. */
export const LIVE_NOTIFICATION_LOGO_ASSET = 'cio_live_notification_logo';

/**
 * A built-in type the plugin knows how to generate code for, keyed by the
 * reverse-DNS identifier shared with both native SDKs and the backend.
 */
type KnownType = {
  /** Swift `ActivityAttributes` type registered on the iOS module. */
  iosAttributes: string;
  /** Swift `Widget` type rendered by the generated widget bundle. */
  iosWidget: string;
  /** Swift branding struct the widget's initializer takes. */
  iosBranding: string;
  /** Whether the template renders a progress bar (only Segments does). */
  iosHasProgress: boolean;
  /** Android `LiveNotificationType` enum constant. */
  androidEnum: string;
};

const KNOWN_TYPES: Record<string, KnownType> = {
  [LIVE_NOTIFICATION_TYPES.segments]: {
    iosAttributes: 'CIOSegmentsAttributes',
    iosWidget: 'CIOSegmentsLiveActivity',
    iosBranding: 'CIOSegmentsBranding',
    iosHasProgress: true,
    androidEnum: 'SEGMENTS',
  },
  [LIVE_NOTIFICATION_TYPES.countdownTimer]: {
    iosAttributes: 'CIOCountdownTimerAttributes',
    iosWidget: 'CIOCountdownTimerLiveActivity',
    iosBranding: 'CIOCountdownTimerBranding',
    iosHasProgress: false,
    androidEnum: 'COUNTDOWN_TIMER',
  },
};

/** Every built-in type, used when an app enables the feature without listing types. */
export const ALL_LIVE_NOTIFICATION_TYPES = Object.keys(KNOWN_TYPES);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Resolve the configured identifiers to the types this plugin build can generate.
 *
 * Unrecognized identifiers are dropped with a warning rather than failing the build: a template
 * added in a newer SDK would otherwise emit a Swift/Kotlin symbol that doesn't exist, turning a
 * config typo into a compile error. When no types are listed the caller gets every built-in, which
 * is what a JavaScript-initialized app needs (its types are chosen at runtime, not at prebuild).
 */
export function resolveLiveNotificationTypes(types?: string[]): string[] {
  if (types === undefined) {
    return ALL_LIVE_NOTIFICATION_TYPES;
  }

  const known: string[] = [];
  for (const type of types) {
    if (KNOWN_TYPES[type]) {
      known.push(type);
    } else {
      console.warn(
        `[customerio-expo-plugin] Ignoring unknown Live Notification type "${type}". ` +
          `Supported types: ${ALL_LIVE_NOTIFICATION_TYPES.join(', ')}.`
      );
    }
  }
  // De-duplicate so a repeated identifier can't emit the same registration twice.
  return [...new Set(known)];
}

/**
 * The app's own identifier for its custom activity type, or undefined when none is configured.
 *
 * A blank value is treated as absent, and a built-in identifier is refused: iOS resolves an
 * activity's reported type from its Swift attributes type, so registering `CIOCustomAttributes`
 * under a built-in template's identifier would make every event for that template resolve to
 * whichever type was registered first.
 */
export function resolveCustomLiveNotificationType(
  customType: string | undefined
): string | undefined {
  const trimmed = customType?.trim();
  if (!trimmed) return undefined;

  if (KNOWN_TYPES[trimmed]) {
    console.warn(
      `[customerio-expo-plugin] Ignoring liveNotifications.customType "${trimmed}": it is a built-in ` +
        `Live Notification type. Use your own reverse-DNS identifier, e.g. "com.myapp.rideshare".`
    );
    return undefined;
  }

  return trimmed;
}

/** True when `logo` points at a remote image rather than a file in the project. */
export function isRemoteLogo(logo: string): boolean {
  return /^https?:\/\//i.test(logo);
}

/**
 * Validate branding up front so a malformed value fails prebuild with a clear message instead of
 * producing native code that throws at runtime.
 */
export function validateLiveNotificationBranding(
  branding: LiveNotificationBranding | undefined
): void {
  if (!branding) return;

  const colors: (keyof LiveNotificationBranding)[] = [
    'backgroundColorHex',
    'textColorHex',
    'accentColorHex',
  ];
  for (const key of colors) {
    const value = branding[key];
    if (value !== undefined && !HEX_COLOR.test(value)) {
      throw new Error(
        `[customerio-expo-plugin] liveNotifications.branding.${key} must be a "#RRGGBB" hex color, got "${value}".`
      );
    }
  }
}

/** `#RRGGBB` -> the `0xRRGGBB` literal used by the generated native code. */
function hexToLiteral(hex: string): string {
  return `0x${hex.slice(1).toUpperCase()}`;
}

// MARK: - iOS

/**
 * Swift for the branding a generated widget passes to `type`'s Live Activity, or `nil` when the
 * app configured no branding (the widget then uses the SDK's default styling).
 */
export function iosBrandingArguments(
  type: string,
  branding: LiveNotificationBranding | undefined
): string | null {
  const known = KNOWN_TYPES[type];
  if (!known || !branding) return null;

  const args: string[] = [];
  // A remote URL can't be resolved at build time, so the widget simply renders no logo.
  if (branding.logo && !isRemoteLogo(branding.logo)) {
    args.push(`logo: Image("${LIVE_NOTIFICATION_LOGO_ASSET}")`);
  }
  if (branding.backgroundColorHex) {
    args.push(`background: Color(hex: ${hexToLiteral(branding.backgroundColorHex)})`);
  }
  if (branding.textColorHex) {
    args.push(`textColor: Color(hex: ${hexToLiteral(branding.textColorHex)})`);
  }
  if (known.iosHasProgress && branding.accentColorHex) {
    args.push(
      `progressCompleteStyle: Color(hex: ${hexToLiteral(branding.accentColorHex)})`
    );
  }
  if (args.length === 0) return null;

  return `${known.iosBranding}(${args.join(', ')})`;
}

/**
 * The `WidgetBundle` body entries rendering each enabled type, branded when configured.
 *
 * `customStructName` is the app's own SwiftUI widget (see `liveNotifications.customWidget`). It
 * takes no branding argument: branding is compiled into the SDK's templates, and a view the app
 * wrote styles itself.
 */
export function iosWidgetBundleEntries(
  types: string[],
  branding: LiveNotificationBranding | undefined,
  customStructName?: string
): string[] {
  const entries = types.map((type) => {
    const known = KNOWN_TYPES[type];
    const brandingArgs = iosBrandingArguments(type, branding);
    return brandingArgs
      ? `${known.iosWidget}(branding: ${brandingArgs})`
      : `${known.iosWidget}()`;
  });

  if (customStructName) {
    entries.push(`${customStructName}()`);
  }

  return entries;
}

/**
 * The full `CIOLiveActivityWidgetBundle.swift` for the injected widget extension.
 *
 * Generated rather than copied so the bundle renders exactly the types the app enabled, with its
 * branding compiled in — iOS branding is SwiftUI in the widget, so it can only be applied here at
 * build time — plus the app's own widget struct when one is configured.
 */
export function generateWidgetBundleSwift(
  types: string[],
  branding: LiveNotificationBranding | undefined,
  customStructName?: string,
  autoInitializes = true
): string {
  let resolvedTypes = types;
  if (!autoInitializes) {
    // JavaScript initialization: the app chooses its types at runtime, so the plugin never learns
    // them and the widget has to be able to render any built-in. Doing this only when nothing else
    // resolved would leave an app that configures a `customWidget` with a widget that renders the
    // custom type and none of the built-ins it also enables.
    resolvedTypes = ALL_LIVE_NOTIFICATION_TYPES;
  } else if (types.length === 0 && !customStructName) {
    // A `WidgetBundle` body has to return at least one widget, so an empty bundle cannot be
    // emitted — it wouldn't compile. This app told us its types, so reaching here is a
    // misconfiguration (an unrecognized `types` list, or a `customWidget` that didn't resolve)
    // worth reporting before falling back.
    console.warn(
      '[customerio-expo-plugin] No Live Notification type resolved for the generated iOS widget; ' +
        'falling back to the built-in templates so the widget extension still compiles.'
    );
    resolvedTypes = ALL_LIVE_NOTIFICATION_TYPES;
  }

  const entries = iosWidgetBundleEntries(resolvedTypes, branding, customStructName)
    .map((entry) => `        ${entry}`)
    .join('\n');

  // SwiftUI has no hex initializer, and the widget can't import the app's helpers.
  const colorHelper = usesGeneratedColors(resolvedTypes, branding)
    ? `
private extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
`
    : '';

  return `import CioLiveActivities_Attributes
import CioLiveActivities_Templates
import SwiftUI
import WidgetKit

// Generated by customerio-expo-plugin from \`config.liveNotifications\`. Renders the Customer.io
// built-in Live Activity templates; the SwiftUI for each one lives in the Customer.io iOS SDK, so
// this bundle is all the host app needs. A custom template is rendered by the SwiftUI file named by
// \`liveNotifications.customWidget\`, copied into this target and instantiated below.
@main
struct CIOLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
${entries}
    }
}
${colorHelper}`;
}

function usesGeneratedColors(
  types: string[],
  branding: LiveNotificationBranding | undefined
): boolean {
  return types.some((type) => {
    const args = iosBrandingArguments(type, branding);
    return args !== null && args.includes('Color(hex:');
  });
}

// MARK: - Placeholder patching

/**
 * Replace `{{LIVE_NOTIFICATION_MODULE_IMPORT}}` and `{{LIVE_NOTIFICATION_MODULE_INIT}}` in the
 * generated SDK initializer.
 *
 * iOS registers the activity types on the SDK config builder, which is what makes push-to-start
 * work on the auto-initialization path. Android applies the enabled types and branding onto the
 * push module's config builder, since Live Notifications are hosted there.
 *
 * A configured `customType` is registered here too. On this path the generated initializer *is* the
 * runtime registration — the React Native wrapper only registers what it is handed at
 * `initialize()` — so without it a custom activity would never get a push-to-start token.
 *
 * `branding` arrives separately because it lives in the build-time options rather than SDK config
 * (it has to reach the iOS widget on both initialization paths). Only Android consumes it here;
 * iOS branding is compiled into the generated widget instead.
 */
export function patchLiveNotificationPlaceholders(
  content: string,
  platform: Platform,
  liveNotifications?: LiveNotificationsSDKConfig,
  branding?: LiveNotificationBranding
): string {
  const types = liveNotifications
    ? resolveLiveNotificationTypes(liveNotifications.types)
    : [];
  const customType = resolveCustomLiveNotificationType(liveNotifications?.customType);

  if (types.length === 0 && !customType) {
    return clearPlaceholders(content, platform);
  }

  validateLiveNotificationBranding(branding);

  return platform === PLATFORM.ANDROID
    ? patchAndroid(content, types, branding, customType)
    : patchIos(content, types, customType);
}

function clearPlaceholders(content: string, platform: Platform): string {
  const withoutImport = content.replace(
    /\n\{\{LIVE_NOTIFICATION_MODULE_IMPORT\}\}\n/g,
    '\n'
  );

  if (platform === PLATFORM.ANDROID) {
    // The Android placeholder sits mid-chain on the push config builder. Collapse the whole chain
    // back onto one line so apps that don't use Live Notifications get byte-identical output.
    return withoutImport.replace(
      /\n[ \t]*\{\{LIVE_NOTIFICATION_MODULE_INIT\}\}\n([ \t]*)\.build\(\)/g,
      '.build()'
    );
  }

  // `[ \t]*` rather than `\s*`: a greedy match would swallow the blank line the location
  // placeholder leaves behind, changing output for apps that use neither module.
  return withoutImport.replace(
    /\n[ \t]*\{\{LIVE_NOTIFICATION_MODULE_INIT\}\}\n/g,
    '\n'
  );
}

function patchIos(
  content: string,
  types: string[],
  customType: string | undefined
): string {
  const registrationLines = types.map(
    (type) => `                .register(${KNOWN_TYPES[type].iosAttributes}.self)`
  );

  if (customType) {
    // One SDK-owned Swift type registered under the app's own identifier. That indirection is what
    // lets a JavaScript app have a custom activity at all: ActivityKit needs a metatype to register
    // and to observe push-to-start for, and a metatype can't cross a bridge.
    registrationLines.push(
      `                .register(CIOCustomAttributes.self, identifier: "${customType}")`
    );
  }

  const registrations = registrationLines.join('\n');

  // `register` is annotated @available(iOS 16.2, *), so the guard is required to compile against
  // a lower deployment target — the app simply has no Live Activities below 16.2.
  const init = `if #available(iOS 16.2, *) {
            _ = builder.addModule(LiveActivitiesModule(config:
                LiveActivityConfigBuilder()
${registrations}
                    .build()))
        }`;

  return content
    .replace(
      /\{\{LIVE_NOTIFICATION_MODULE_IMPORT\}\}/g,
      'import CioLiveActivities\nimport CioLiveActivities_Attributes\nimport CioLiveActivities_Templates'
    )
    .replace(/\{\{LIVE_NOTIFICATION_MODULE_INIT\}\}/g, init);
}

function patchAndroid(
  content: string,
  types: string[],
  branding: LiveNotificationBranding | undefined,
  customType: string | undefined
): string {
  const enumArgs = types
    .map((type) => `                        LiveNotificationType.${KNOWN_TYPES[type].androidEnum},`)
    .join('\n');

  // The placeholder already sits at the chain's indentation, so the first line adds none.
  const lines: string[] = [];
  if (types.length > 0) {
    lines.push('.enableLiveNotificationTypes(', enumArgs, '                    )');
  }

  if (customType) {
    // Allowlisting the identifier is both necessary and sufficient on Android: the push handler
    // drops any live notification whose type isn't enabled, and a type with no built-in template
    // falls through to the host app's render callback.
    lines.push(
      `${lines.length === 0 ? '' : '                    '}.enableCustomLiveNotificationTypes("${customType}")`
    );
  }

  const brandingCall = androidBrandingCall(branding);
  if (brandingCall) {
    lines.push(brandingCall);
  }

  const init = lines.join('\n');

  const imports: string[] = [];
  if (types.length > 0) {
    // Only the enum overload needs the import; a custom type is passed as a plain string.
    imports.push('import io.customer.messagingpush.livenotification.LiveNotificationType');
  }
  if (brandingCall) {
    imports.unshift(
      'import android.graphics.Color',
      'import io.customer.messagingpush.livenotification.LiveNotificationAsset',
      'import io.customer.messagingpush.livenotification.LiveNotificationBranding'
    );
  }

  // A custom type with no branding needs no import at all; drop the whole line rather than leaving
  // the blank one an empty replacement would.
  const withImports =
    imports.length > 0
      ? content.replace(/\{\{LIVE_NOTIFICATION_MODULE_IMPORT\}\}/g, imports.join('\n'))
      : content.replace(/\n\{\{LIVE_NOTIFICATION_MODULE_IMPORT\}\}\n/g, '\n');

  return withImports.replace(/\{\{LIVE_NOTIFICATION_MODULE_INIT\}\}/g, init);
}

function androidBrandingCall(
  branding: LiveNotificationBranding | undefined
): string | null {
  if (!branding) return null;

  const accent = branding.accentColorHex
    ? `Color.parseColor("${branding.accentColorHex}")`
    : 'Color.TRANSPARENT';

  let logo = 'null';
  if (branding.logo) {
    logo = isRemoteLogo(branding.logo)
      ? `LiveNotificationAsset.RemoteUrl("${branding.logo}")`
      : // Resource ids are assigned at compile time, so the name is resolved at runtime.
        `application.resources
                                .getIdentifier("${LIVE_NOTIFICATION_LOGO_ASSET}", "drawable", application.packageName)
                                .takeIf { it != 0 }
                                ?.let(LiveNotificationAsset::Drawable)`;
  }

  return `                    .setLiveNotificationBranding(
                        LiveNotificationBranding(
                            companyName = "${branding.companyName ?? ''}",
                            accentColor = ${accent},
                            logo = ${logo},
                        )
                    )`;
}
