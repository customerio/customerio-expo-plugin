import fs from 'fs';
import os from 'os';
import path from 'path';

import { resolveCustomLiveActivityWidget } from '../../../plugin/src/helpers/utils/liveNotificationCustomWidget';
import { isLiveNotificationsEnabled } from '../../../plugin/src/helpers/utils/liveNotificationsEnabled';
import {
  generateWidgetBundleSwift,
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
    options.liveNotifications?.branding,
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
