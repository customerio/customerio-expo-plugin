import fs from 'fs';
import os from 'os';
import path from 'path';

import { PLATFORM } from '../../../plugin/src/helpers/constants/common';
import { resolveCustomLiveActivityWidget } from '../../../plugin/src/helpers/utils/liveNotificationCustomWidget';
import {
  isLiveNotificationsEnabled,
  resolveSdkConfigForLiveNotifications,
} from '../../../plugin/src/helpers/utils/liveNotificationsEnabled';
import {
  generateWidgetBundleSwift,
  patchLiveNotificationPlaceholders,
  resolveLiveNotificationTypes,
} from '../../../plugin/src/helpers/utils/patchLiveNotificationCode';
import type {
  CustomerIOPluginLiveNotificationsOptions,
  LiveNotificationsSDKConfig,
  NativeSDKConfig,
} from '../../../plugin/src/types/cio-types';
import { logger } from '../../../plugin/src/utils/logger';

/**
 * Every combination of the three dimensions that change how Live Notifications are generated:
 *
 * - **initialization**: automatic (`config.liveNotifications` present) vs from JavaScript
 *   (`liveNotifications.enabled`, no SDK config)
 * - **feature**: off vs on
 * - **templates**: built-in vs custom
 *
 * The dimensions interact, which is the reason for testing them as a grid rather than one at a
 * time. Two behaviours only make sense as a consequence of a pair: a missing `customType` is a
 * misconfiguration when the app auto-initializes and correct when it initializes from JavaScript,
 * and the widget must render every built-in on the JavaScript path precisely because the plugin
 * cannot know which ones the app will enable.
 */

const SEGMENTS = 'io.customer.livenotifications.segments';
const COUNTDOWN = 'io.customer.livenotifications.countdowntimer';
const CUSTOM_TYPE = 'com.myapp.rideshare';
const STRUCT = 'RideshareLiveActivity';
const BRANDING = { backgroundColorHex: '#101010', accentColorHex: '#00A0DF' };
const WIDGET_SOURCE = `import SwiftUI\nstruct ${STRUCT}: Widget { var body: some WidgetConfiguration { fatalError() } }\n`;

const cdpApiKey = 'test-key';

let projectRoot: string;
let warn: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

/** Build-time plugin options, i.e. the top-level `liveNotifications` key. */
const buildOptions = (
  overrides: Partial<CustomerIOPluginLiveNotificationsOptions> = {}
): CustomerIOPluginLiveNotificationsOptions => ({ ...overrides });

/** A `customWidget` pointing at a file that really exists in the temp project. */
const customWidget = () => ({
  sourceFile: './ios-widgets/RideshareLiveActivity.swift',
  structName: STRUCT,
});

const sdkConfig = (
  liveNotifications: LiveNotificationsSDKConfig | undefined
): NativeSDKConfig => ({ cdpApiKey, liveNotifications }) as NativeSDKConfig;

/** What the generated widget bundle ends up rendering, given a cell of the grid. */
const bundleFor = (options: {
  liveNotifications?: LiveNotificationsSDKConfig;
  build?: CustomerIOPluginLiveNotificationsOptions;
  autoInitializes: boolean;
}) => {
  const resolved = resolveCustomLiveActivityWidget({
    liveNotifications: options.liveNotifications,
    buildOptions: options.build,
    autoInitializes: options.autoInitializes,
    projectRoot,
    reservedFilenames: [],
  });
  return generateWidgetBundleSwift(
    resolveLiveNotificationTypes(options.liveNotifications?.types),
    // Branding is a build-time option, not SDK config: it is compiled into this bundle, so it has
    // to be readable on the JavaScript-initialization path too.
    options.build?.branding,
    resolved?.structName,
    options.autoInitializes
  );
};

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-matrix-'));
  fs.mkdirSync(path.join(projectRoot, 'ios-widgets'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'ios-widgets/RideshareLiveActivity.swift'),
    WIDGET_SOURCE
  );
  warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  consoleWarn.mockRestore();
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('Live Notifications config matrix — feature off', () => {
  test('auto initialization, no liveNotifications config: nothing is generated', () => {
    expect(isLiveNotificationsEnabled(undefined, sdkConfig(undefined))).toBe(false);
  });

  test('JavaScript initialization without enabled: nothing is generated', () => {
    expect(isLiveNotificationsEnabled(buildOptions(), undefined)).toBe(false);
    expect(isLiveNotificationsEnabled(buildOptions({ enabled: false }), undefined)).toBe(
      false
    );
  });

  test('a customWidget cannot switch the feature on by itself', () => {
    // It describes how to render, never whether the feature is on — otherwise a leftover widget
    // config would silently add a target to an app that had turned Live Notifications off.
    expect(
      isLiveNotificationsEnabled(buildOptions({ customWidget: customWidget() }), undefined)
    ).toBe(false);
  });
});

describe('Live Notifications config matrix — auto initialization', () => {
  // The one cell where the two dimensions disagree: SDK config asks for the feature and the
  // build-time flag refuses it. An explicit `false` is an opt-out, so it wins — otherwise an app
  // could not turn the native artifacts off without also deleting its type list.
  test('enabled:false overrides an SDK config that would otherwise enable the feature', () => {
    const config = { types: [SEGMENTS], customType: CUSTOM_TYPE };

    expect(isLiveNotificationsEnabled(buildOptions({ enabled: false }), sdkConfig(config))).toBe(
      false
    );
    // Omitting the flag still infers it from the config, which is the common auto-init case.
    expect(isLiveNotificationsEnabled(buildOptions(), sdkConfig(config))).toBe(true);
  });

  // The opt-out has to reach the generated initializer as well as the build-time artifacts. If it
  // only turned off the pod subspec, the Swift below would still `import CioLiveActivities` and
  // construct a `LiveActivitiesModule` against a module the build no longer links.
  test('enabled:false also clears the registration in the generated initializer', () => {
    const config = { types: [SEGMENTS], customType: CUSTOM_TYPE };
    const template =
      'import CioDataPipelines\n{{LIVE_NOTIFICATION_MODULE_IMPORT}}\n\nlet builder = X()\n' +
      '        {{LIVE_NOTIFICATION_MODULE_INIT}}\nCustomerIO.initialize()\n';

    const enabled = resolveSdkConfigForLiveNotifications(buildOptions(), sdkConfig(config));
    const optedOut = resolveSdkConfigForLiveNotifications(
      buildOptions({ enabled: false }),
      sdkConfig(config)
    );

    expect(
      patchLiveNotificationPlaceholders(template, PLATFORM.IOS, enabled?.liveNotifications)
    ).toContain('LiveActivitiesModule');
    const optedOutSwift = patchLiveNotificationPlaceholders(
      template,
      PLATFORM.IOS,
      optedOut?.liveNotifications
    );
    expect(optedOutSwift).not.toContain('LiveActivitiesModule');
    expect(optedOutSwift).not.toContain('CioLiveActivities');
    // Everything unrelated to Live Notifications survives untouched.
    expect(optedOutSwift).toContain('import CioDataPipelines');
    expect(optedOut?.cdpApiKey).toBe(cdpApiKey);
  });

  test('built-in templates: the bundle renders exactly the configured types', () => {
    const config = { types: [SEGMENTS] };
    expect(isLiveNotificationsEnabled(undefined, sdkConfig(config))).toBe(true);

    const bundle = bundleFor({ liveNotifications: config, autoInitializes: true });
    expect(bundle).toContain('CIOSegmentsLiveActivity()');
    expect(bundle).not.toContain('CIOCountdownTimerLiveActivity()');
    expect(bundle).not.toContain(`${STRUCT}()`);
    expect(warn).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  test('custom template: the bundle renders only the app struct', () => {
    const config = { types: [], customType: CUSTOM_TYPE };
    expect(isLiveNotificationsEnabled(undefined, sdkConfig(config))).toBe(true);

    const bundle = bundleFor({
      liveNotifications: config,
      build: buildOptions({ customWidget: customWidget() }),
      autoInitializes: true,
    });
    expect(bundle).toContain(`${STRUCT}()`);
    expect(bundle).not.toContain('CIOSegmentsLiveActivity()');
    // Both halves are present, so nothing to report.
    expect(warn).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  test('both: the bundle renders the configured types and the app struct', () => {
    const config = { types: [SEGMENTS, COUNTDOWN], customType: CUSTOM_TYPE };
    const bundle = bundleFor({
      liveNotifications: config,
      build: buildOptions({ customWidget: customWidget() }),
      autoInitializes: true,
    });
    expect(bundle).toContain('CIOSegmentsLiveActivity()');
    expect(bundle).toContain('CIOCountdownTimerLiveActivity()');
    expect(bundle).toContain(`${STRUCT}()`);
    expect(warn).not.toHaveBeenCalled();
  });

  test('customType without a customWidget warns: the SDK would register a type nothing draws', () => {
    const resolved = resolveCustomLiveActivityWidget({
      liveNotifications: { customType: CUSTOM_TYPE },
      buildOptions: undefined,
      autoInitializes: true,
      projectRoot,
      reservedFilenames: [],
    });
    expect(resolved).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(CUSTOM_TYPE));
  });

  test('customWidget without a customType warns: the widget would draw a type nothing starts', () => {
    const resolved = resolveCustomLiveActivityWidget({
      liveNotifications: { types: [SEGMENTS] },
      buildOptions: buildOptions({ customWidget: customWidget() }),
      autoInitializes: true,
      projectRoot,
      reservedFilenames: [],
    });
    expect(resolved?.structName).toEqual(STRUCT);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('config.liveNotifications.customType is not set')
    );
  });
});

describe('Live Notifications config matrix — JavaScript initialization', () => {
  test('built-in templates: every built-in is rendered, with no warning', () => {
    const build = buildOptions({ enabled: true });
    expect(isLiveNotificationsEnabled(build, undefined)).toBe(true);

    const bundle = bundleFor({ build, autoInitializes: false });
    expect(bundle).toContain('CIOSegmentsLiveActivity()');
    expect(bundle).toContain('CIOCountdownTimerLiveActivity()');
    // The app picks its types at runtime, so rendering all of them is correct rather than a
    // fallback from a misconfiguration — warning here would fire on a supported setup.
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test('custom template: the app struct renders alongside the built-ins', () => {
    const build = buildOptions({ enabled: true, customWidget: customWidget() });
    const bundle = bundleFor({ build, autoInitializes: false });

    expect(bundle).toContain(`${STRUCT}()`);
    // The built-ins have to be there too: the app may enable them from JavaScript, and the plugin
    // has no way to know. Rendering only the custom struct would make those silently un-drawable.
    expect(bundle).toContain('CIOSegmentsLiveActivity()');
    expect(bundle).toContain('CIOCountdownTimerLiveActivity()');
  });

  test('a missing customType is not reported: it is supplied at runtime', () => {
    const resolved = resolveCustomLiveActivityWidget({
      liveNotifications: undefined,
      buildOptions: buildOptions({ enabled: true, customWidget: customWidget() }),
      autoInitializes: false,
      projectRoot,
      reservedFilenames: [],
    });
    expect(resolved?.structName).toEqual(STRUCT);
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * Branding cuts across the grid because it is the one value both platforms consume at build time:
 * iOS compiles it into the widget's SwiftUI, and Android has it generated into the initializer.
 * That is why it lives in the build-time options — SDK config only exists on the automatic path, and
 * a widget already compiled cannot be branded afterwards.
 */
describe('Live Notifications config matrix — branding', () => {
  test('auto initialization: branding is compiled into the built-in widgets', () => {
    const bundle = bundleFor({
      liveNotifications: { types: [SEGMENTS] },
      build: buildOptions({ branding: BRANDING }),
      autoInitializes: true,
    });

    expect(bundle).toContain(
      'CIOSegmentsLiveActivity(branding: CIOSegmentsBranding(background: Color(hex: 0x101010)'
    );
    expect(bundle).toContain('progressCompleteStyle: Color(hex: 0x00A0DF)');
    // The hex helper is only emitted when a generated color actually needs it.
    expect(bundle).toContain('init(hex: UInt32)');
  });

  test('JavaScript initialization: branding still reaches the widget', () => {
    // The point of the move. There is no SDK config on this path, so branding read from there would
    // leave a JavaScript-initialized app permanently stuck with the SDK's default styling.
    const bundle = bundleFor({
      build: buildOptions({ enabled: true, branding: BRANDING }),
      autoInitializes: false,
    });

    expect(bundle).toContain('CIOSegmentsLiveActivity(branding: CIOSegmentsBranding(');
    expect(bundle).toContain('CIOCountdownTimerLiveActivity(branding: CIOCountdownTimerBranding(');
    expect(bundle).toContain('background: Color(hex: 0x101010)');
  });

  test('a custom template takes no branding argument, on either path', () => {
    // The app wrote that SwiftUI, so it styles itself; passing branding in would not compile.
    for (const autoInitializes of [true, false]) {
      const bundle = bundleFor({
        liveNotifications: autoInitializes
          ? { types: [SEGMENTS], customType: CUSTOM_TYPE }
          : undefined,
        build: buildOptions({
          enabled: true,
          branding: BRANDING,
          customWidget: customWidget(),
        }),
        autoInitializes,
      });

      expect(bundle).toContain(`${STRUCT}()`);
      expect(bundle).not.toContain(`${STRUCT}(branding`);
      expect(bundle).toContain('CIOSegmentsLiveActivity(branding:');
    }
  });

  test('no branding: the widgets use the SDK default styling and no hex helper is emitted', () => {
    const bundle = bundleFor({
      build: buildOptions({ enabled: true }),
      autoInitializes: false,
    });

    expect(bundle).toContain('CIOSegmentsLiveActivity()');
    expect(bundle).not.toContain('init(hex: UInt32)');
  });

  test('branding alone cannot switch the feature on', () => {
    // Same reasoning as `customWidget`: it describes how templates look, never whether they run.
    expect(isLiveNotificationsEnabled(buildOptions({ branding: BRANDING }), undefined)).toBe(
      false
    );
  });
});
