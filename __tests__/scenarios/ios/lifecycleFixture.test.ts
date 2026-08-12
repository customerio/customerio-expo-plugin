import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getFixturePath } from '../../utils';

// The fixture filesystem helper is intentionally CommonJS because the
// generated-app scripts execute directly under Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  assertSafeContainedPath,
} = require('../../../lifecycle-fixture/scripts/lib');

const repoRoot = path.resolve(__dirname, '../../..');
const originalRoot = getFixturePath('ios', 'expo57-generated');
const patchedRoot = getFixturePath('ios', 'expo57-patched');
const probeRoot = path.join(repoRoot, 'lifecycle-fixture/probe-module');
const scriptsRoot = path.join(repoRoot, 'lifecycle-fixture/scripts');

const digest = (bytes: Buffer | string): string =>
  crypto.createHash('sha256').update(bytes).digest('hex');
const read = (root: string, relative: string): string =>
  fs.readFileSync(path.join(root, relative), 'utf8');

describe('Expo 57 lifecycle source provenance', () => {
  const original = JSON.parse(read(originalRoot, 'PROVENANCE.json'));
  const patched = JSON.parse(read(patchedRoot, 'PROVENANCE.json'));
  const patchLock = JSON.parse(
    fs.readFileSync(
      path.join(scriptsRoot, 'expo57-source-patch.lock.json'),
      'utf8'
    )
  );

  it('pins the audited dependency topology exactly', () => {
    expect(original.packageVersions).toMatchObject({
      'expo': '57.0.12',
      'expo-modules-core': '57.0.10',
      'expo-notifications': '57.0.10',
      'react-native': '0.86.2',
      'customerio-reactnative': '6.6.2',
      'customerio-expo-plugin': '3.7.1',
    });
    expect(patchLock).toMatchObject({
      expoVersion: '57.0.12',
      expoModulesCoreVersion: '57.0.10',
      expoNotificationsVersion: '57.0.10',
      reactNativeVersion: '0.86.2',
      customerioReactNativeVersion: '6.6.2',
      customerioExpoPluginVersion: '3.7.1',
      customerioIOSVersion: '4.7.2',
      firebaseIOSMessagingVersion: '12.17.0',
    });
  });

  it.each(Object.entries(original.files))(
    'keeps original source bytes locked: %s',
    (relative, metadata: any) => {
      expect(digest(fs.readFileSync(path.join(originalRoot, relative)))).toBe(
        metadata.sha256
      );
    }
  );

  it.each(Object.entries(patched.files))(
    'keeps patched fixture bytes locked: %s',
    (relative, metadata: any) => {
      expect(digest(fs.readFileSync(path.join(patchedRoot, relative)))).toBe(
        metadata.sha256
      );
    }
  );

  it.each(Object.entries(original.localInputs))(
    'locks fixture-only patch/config input: %s',
    (relative, metadata: any) => {
      expect(digest(fs.readFileSync(path.join(repoRoot, relative)))).toBe(
        metadata.sha256
      );
    }
  );

  it('pins every patched framework source plus relevant podspec/config inputs', () => {
    const originals = Object.keys(original.files);
    expect(originals).toEqual(
      expect.arrayContaining([
        'expo/AppDelegatesLoaderDelegate.swift',
        'expo/ExpoAppDelegate.swift',
        'expo/Expo.podspec',
        'expo-modules-core/ExpoAppDelegateSubscriberManager.swift',
        'expo-modules-core/ExpoModulesCore.podspec',
        'expo-notifications/NotificationCenterManager.swift',
        'expo-notifications/EmitterModule.swift',
        'expo-notifications/ExpoNotifications.podspec',
        'expo-notifications/expo-module.config.json',
        'generated-app/Podfile.properties.json',
        'customerio-ios/CioNotificationCenterDelegate.swift',
        'customerio-ios/CioAppDelegateAPN.swift',
        'customerio-ios/CioAppDelegateFCM.swift',
      ])
    );
    expect(Object.keys(patched.files)).toEqual(
      expect.arrayContaining([
        'framework/expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift',
        'framework/expo/ios/AppDelegates/ExpoAppDelegate.swift',
        'framework/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift',
        'framework/expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift',
        'framework/expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift',
        'variants/apn/AppDelegate.swift',
        'variants/apn/app.json',
        'variants/fcm/AppDelegate.swift',
        'variants/fcm/app.json',
        'variants/nopush/AppDelegate.swift',
        'variants/nopush/app.json',
        'variants/apn/Podfile.properties.json',
        'variants/fcm/Podfile.properties.json',
        'variants/nopush/Podfile.properties.json',
      ])
    );
    expect(Object.keys(original.localInputs)).toEqual(
      expect.arrayContaining([
        'tsconfig.json',
        'tsconfig.build.json',
        'scripts/compatibility/configure-plugin.js',
        'lifecycle-fixture/javascript/LifecycleReceipts.ts',
        'lifecycle-fixture/probe-module/expo-module.config.json',
        'lifecycle-fixture/probe-module/ios/CioLifecycleProbe.podspec',
        'lifecycle-fixture/probe-module/ios/CioLifecycleProbeBootstrap.m',
        'lifecycle-fixture/probe-module/ios/CioLifecycleProbeModule.swift',
        'lifecycle-fixture/probe-module/ios/LifecycleTraceModel.swift',
        'lifecycle-fixture/probe-module/ios/LifecycleTraceProbe.swift',
        'lifecycle-fixture/probe-module/ios/LifecycleTraceProbeObserver.swift',
        'lifecycle-fixture/probe-module/ios/LifecycleTraceRecorder.swift',
        'lifecycle-fixture/scripts/expo57-source-patch.lock.json',
        'lifecycle-fixture/scripts/install-probe.js',
        'lifecycle-fixture/scripts/lib.js',
        'lifecycle-fixture/scripts/patch-customerio-pod-sources.js',
        'lifecycle-fixture/scripts/patch-expo57-sources.js',
        'lifecycle-fixture/scripts/test-expo-producer-captures.py',
        'lifecycle-fixture/scripts/test-expo-runtime-capture.py',
        'lifecycle-fixture/scripts/validate-expo-runtime-capture.py',
      ])
    );
  });
});

describe('no-seat fixture bridge', () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(probeRoot, 'expo-module.config.json'), 'utf8')
  );
  const probeText = fs
    .readdirSync(path.join(probeRoot, 'ios'))
    .filter((name) => /\.(swift|m|h)$/.test(name))
    .map((name) => fs.readFileSync(path.join(probeRoot, 'ios', name), 'utf8'))
    .join('\n');

  it('declares only the harness context/control module', () => {
    expect(config.apple.modules).toEqual(['CioLifecycleProbeModule']);
    expect(config.apple).not.toHaveProperty('appDelegateSubscribers');
    expect(
      fs.existsSync(
        path.join(probeRoot, 'ios/CioLifecycleProbeSubscriber.swift')
      )
    ).toBe(false);
    expect(fs.existsSync(path.join(probeRoot, 'app.plugin.js'))).toBe(false);
  });

  it('owns no Expo subscriber or notification delegate callback seat', () => {
    expect(probeText).not.toContain('ExpoAppDelegateSubscriber');
    expect(probeText).not.toContain(': NotificationDelegate');
    expect(probeText).not.toContain('addDelegate(self)');
    expect(probeText).not.toContain('UNUserNotificationCenter.current');
  });

  it('accepts only canonical probe vocabulary before recording', () => {
    expect(probeText).toContain(
      'LifecycleTraceCallback(rawValue: callbackValue)'
    );
    expect(probeText).toContain('LifecycleTraceOwner(rawValue: ownerValue)');
    expect(probeText).toContain('LifecycleTraceKind(rawValue: kindValue)');
    expect(probeText).toContain('LifecycleTracePhase(rawValue: phaseValue)');
    expect(probeText).toContain('LifecycleTraceAliasNamespace(rawValue: key)');
    expect(probeText).toContain('isClosedEnumValue(value, for: closed)');
    expect(probeText).toContain('object: center');
    expect(probeText).toContain(
      'userInfo[LifecycleTraceProbe.processInstanceIDKey] as? String'
    );
    expect(probeText).toContain(
      '== LifecycleTraceHarness.sharedRecorder?.processInstanceID'
    );
  });

  it('closes only from supported native result seats and never from JavaScript', () => {
    expect(probeText).toContain('phase == .result');
    expect(probeText).toContain('guard !closeScheduled else { return false }');
    expect(probeText).toContain('if shouldClose { closeScheduled = true }');
    expect(probeText).toContain(
      'LifecycleTraceExpoSupport.isColdStart(scenario)'
    );
    expect(probeText).toContain(
      'observed.contains(.rctInstanceDidLoadBundleNotification)'
    );
    expect(probeText).toContain(
      'observed.contains(.rctJavaScriptDidLoadNotification)'
    );
    expect(probeText).toContain('self?.recordRCTNotification(callback)');
    expect(probeText).toContain(
      'Self.closeScenarioIfTerminal(after: callback, phase: .stateChange)'
    );
    expect(probeText).toContain('LifecycleTraceExpoSupport.supports(scenario)');
    expect(probeText).not.toContain('Function("endScenario")');
    expect(probeText).not.toContain('AsyncFunction("endScenario")');
    expect(probeText).not.toContain('case (.backgroundFetch');
    expect(probeText).not.toContain('case (.notificationSettings');
  });

  it('refuses installer paths outside the generated fixture root before removal', () => {
    const installer = fs.readFileSync(
      path.join(scriptsRoot, 'install-probe.js'),
      'utf8'
    );
    expect(installer).toContain("path.join(REPO_ROOT, 'ci-test-apps')");
    expect(installer).toContain('fs.realpathSync(requestedAppPath)');
    expect(installer).toContain('relativeAppPath.startsWith(`..${path.sep}`)');
    expect(installer.indexOf('fs.realpathSync(requestedAppPath)')).toBeLessThan(
      installer.indexOf('fs.rmSync(moduleDest')
    );
  });
});

describe('fixture filesystem mutation boundary', () => {
  it('rejects a descendant symlink before a recursive mutation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-expo-root-'));
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cio-expo-external-')
    );
    try {
      fs.symlinkSync(external, path.join(root, 'modules'), 'dir');
      expect(() =>
        assertSafeContainedPath(
          root,
          path.join(root, 'modules/cio-lifecycle-probe'),
          { allowMissing: true, label: 'test module destination' }
        )
      ).toThrow('refusing symbolic-link component');
      expect(fs.existsSync(external)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it('allows a missing descendant only under a real contained parent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-expo-root-'));
    try {
      fs.mkdirSync(path.join(root, 'modules'));
      const target = path.join(root, 'modules/cio-lifecycle-probe/index.js');
      expect(
        assertSafeContainedPath(root, target, {
          allowMissing: true,
          label: 'test module destination',
        })
      ).toBe(
        path.join(fs.realpathSync(root), 'modules/cio-lifecycle-probe/index.js')
      );
      expect(() =>
        assertSafeContainedPath(root, path.join(root, '../escape'), {
          allowMissing: true,
          label: 'test escape',
        })
      ).toThrow('path escapes');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an output root whose repository-relative ancestor is a symlink', () => {
    const trusted = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-expo-trusted-'));
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cio-expo-external-')
    );
    try {
      const repo = path.join(trusted, 'repo');
      fs.mkdirSync(repo);
      fs.symlinkSync(external, path.join(repo, 'fixtures'), 'dir');
      const logicalOutputRoot = path.join(repo, 'fixtures/ios/generated');
      expect(() =>
        assertSafeContainedPath(repo, logicalOutputRoot, {
          allowMissing: true,
          label: 'test snapshot root',
        })
      ).toThrow('refusing symbolic-link component');
    } finally {
      fs.rmSync(trusted, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it('uses the shared guard in every mutating fixture script and invokes tar without a shell', () => {
    for (const script of [
      'install-probe.js',
      'patch-expo57-sources.js',
      'patch-customerio-pod-sources.js',
      'pin-expo-fixture-sources.js',
    ]) {
      const source = read(scriptsRoot, script);
      expect(source).toContain('assertSafeContainedPath');
      expect(source).toContain('assertSafeContainedPath(REPO_ROOT,');
    }
    const pinner = read(scriptsRoot, 'pin-expo-fixture-sources.js');
    expect(pinner).toContain("execFileSync(\n      'tar'");
    expect(pinner).not.toContain('execSync(');
  });

  it('allows both snapshot patchers to bootstrap a missing provenance file', () => {
    for (const script of [
      'patch-expo57-sources.js',
      'patch-customerio-pod-sources.js',
    ]) {
      const source = read(scriptsRoot, script);
      expect(source).toContain(
        "{ allowMissing: true, label: 'patched snapshot provenance' }"
      );
      expect(source).toContain('fs.existsSync(provenancePath)');
      expect(source).toContain(
        "schema: 'cio-expo57-patched-source-snapshot/1'"
      );
      const initialGuard = source.indexOf(
        "{ allowMissing: true, label: 'patched snapshot provenance' }"
      );
      const bootstrapDecision = source.indexOf(
        'fs.existsSync(provenancePath)',
        initialGuard
      );
      const finalGuard = source.indexOf(
        'assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, provenancePath',
        bootstrapDecision
      );
      const write = source.indexOf('fs.writeFileSync(', finalGuard);
      expect(initialGuard).toBeGreaterThan(-1);
      expect(bootstrapDecision).toBeGreaterThan(initialGuard);
      expect(finalGuard).toBeGreaterThan(bootstrapDecision);
      expect(write).toBeGreaterThan(finalGuard);
    }
  });
});

describe('exact-hash generated-source observer patches', () => {
  const lock = JSON.parse(
    fs.readFileSync(
      path.join(scriptsRoot, 'expo57-source-patch.lock.json'),
      'utf8'
    )
  );
  const patcher = fs.readFileSync(
    path.join(scriptsRoot, 'patch-expo57-sources.js'),
    'utf8'
  );
  const podPatcher = fs.readFileSync(
    path.join(scriptsRoot, 'patch-customerio-pod-sources.js'),
    'utf8'
  );
  const patchedFramework = (relative: string): string =>
    read(patchedRoot, `framework/${relative}`);

  it('fails closed on both pre-patch and post-patch hashes', () => {
    for (const entry of Object.values(lock.files) as any[]) {
      expect(entry.preSha256.length).toBeGreaterThanOrEqual(1);
      expect(entry.postSha256.length).toBeGreaterThanOrEqual(1);
      entry.preSha256.forEach((hash: string) =>
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
      );
      entry.postSha256.forEach((hash: string) =>
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
      );
      expect(
        entry.preSha256.some((hash: string) => entry.postSha256.includes(hash))
      ).toBe(false);
    }
    expect(patcher).toContain('refused unexpected source hash');
    expect(patcher).toContain('patched hash ${afterHash} is not locked');
    expect(patcher).toContain('Refusing to patch outside ci-test-apps');
    expect(podPatcher).toContain('Refusing to patch outside ci-test-apps');
    for (const source of [patcher, podPatcher]) {
      expect(source).toContain('CIO_LIFECYCLE_PROCESS_INSTANCE_ID');
      expect(source).toContain('userInfo["process_instance_id"]');
      expect(source).toContain('object: center');
    }
  });

  it('records registration only after real Expo subscriber registration', () => {
    const source = patchedFramework(
      'expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift'
    );
    expect(source.indexOf('registerSubscribersFrom')).toBeLessThan(
      source.indexOf('"expo.subscriber-registered"')
    );
    expect(source.indexOf('registerReactDelegateHandlersFrom')).toBeLessThan(
      source.indexOf('"expo.subscriber-registered"')
    );
  });

  it('uses real Expo launch and subscriber-manager forwarding seats', () => {
    const appDelegate = patchedFramework(
      'expo/ios/AppDelegates/ExpoAppDelegate.swift'
    );
    const manager = patchedFramework(
      'expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift'
    );
    expect(appDelegate).toContain(
      '"expo.app-delegate-will-finish-launching-forwarded"'
    );
    expect(appDelegate).toContain(
      '"expo.app-delegate-did-finish-launching-forwarded"'
    );
    expect(appDelegate).toContain('if cioLifecycleIsColdStartScenario()');
    expect(
      patchedFramework('expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift')
    ).toContain('if cioLifecycleIsColdStartScenario()');
    for (const callback of [
      'expo.subscriber.did-become-active-forwarded',
      'expo.subscriber.open-url-forwarded',
      'expo.subscriber.continue-user-activity-forwarded',
      'expo.subscriber.perform-quick-action-forwarded',
      'expo.subscriber.did-register-for-remote-notifications-forwarded',
      'expo.subscriber.did-fail-to-register-for-remote-notifications-forwarded',
      'expo.subscriber.did-receive-remote-notification-forwarded',
      'expo.subscriber.perform-background-fetch-forwarded',
    ]) {
      expect(manager).toContain(`"${callback}"`);
    }
  });

  it('forces the generated fixture to compile patched ExpoModulesCore sources', () => {
    expect(lock.files.podfileProperties).toMatchObject({
      path: 'ios/Podfile.properties.json',
    });
    expect(patcher).toContain(
      "properties.EXPO_USE_PRECOMPILED_MODULES = 'false'"
    );
    for (const variant of ['apn', 'fcm', 'nopush']) {
      const properties = JSON.parse(
        read(patchedRoot, `variants/${variant}/Podfile.properties.json`)
      );
      expect(properties.EXPO_USE_PRECOMPILED_MODULES).toBe('false');
    }
  });

  it('uses NotificationCenterManager and EmitterModule without a trace delegate', () => {
    const manager = patchedFramework(
      'expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift'
    );
    const emitter = patchedFramework(
      'expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift'
    );
    expect(manager).toContain(
      '"expo.notification-center-manager.will-present-forwarded"'
    );
    expect(manager).toContain(
      '"expo.notification-center-manager.did-receive-response-forwarded"'
    );
    expect(manager).not.toContain('"notification-center.did-receive-response"');
    expect(manager).toContain('"notification-center.settings"');
    expect(emitter).toContain('"expo.notifications-emitter-created"');
    expect(emitter).toContain(
      '"expo.notifications-emitter.notification-received-event-sent"'
    );
    expect(emitter).toContain(
      '"expo.notifications-emitter.notification-response-event-sent"'
    );
    expect(emitter).toContain('"expo.last-notification-response-pulled"');
  });

  it('does not add, wrap, retain, invoke, or inspect a completion handler', () => {
    const pairs = [
      [
        'expo-modules-core/ExpoAppDelegateSubscriberManager.swift',
        'expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift',
      ],
      [
        'expo-notifications/NotificationCenterManager.swift',
        'expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift',
      ],
      [
        'expo-notifications/EmitterModule.swift',
        'expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift',
      ],
    ];
    for (const [originalPath, patchedPath] of pairs) {
      const before = read(originalRoot, originalPath);
      const after = patchedFramework(patchedPath);
      expect(after.match(/completionHandler/g)?.length ?? 0).toBe(
        before.match(/completionHandler/g)?.length ?? 0
      );
    }
    expect(patcher).not.toContain('aggregatedHandler:');
    expect(podPatcher).not.toContain('aggregatedHandler:');
  });

  it('uses the production Customer.io push predicate in every notification helper', () => {
    expect(patcher).toContain(
      'userInfo["CIO-Delivery-ID"] != nil && userInfo["CIO-Delivery-Token"] != nil'
    );
    expect(patcher).not.toContain(
      'userInfo["CIO-Delivery-ID"] != nil || userInfo["CIO-Delivery-Token"] != nil'
    );
  });

  it('patches the generated AppDelegate raw OS seats without changing production transforms', () => {
    const appDelegate = read(patchedRoot, 'variants/apn/AppDelegate.swift');
    expect(appDelegate).toContain('"application.did-finish-launching"');
    expect(appDelegate).toContain('"application.open-url"');
    expect(appDelegate).toContain('"application.continue-user-activity"');
    expect(appDelegate).toContain('"host.route-url"');
    expect(appDelegate).toContain('"customerio.route-deep-link"');
    expect(appDelegate).toContain(
      'URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems != nil'
    );
    expect(appDelegate).toContain('"host.route-user-activity"');
    expect(appDelegate).toContain('let handled = super.application');
    expect(appDelegate).toContain(
      '"application.did-register-for-remote-notifications"'
    );
    expect(appDelegate).toContain(
      '"application.did-fail-to-register-for-remote-notifications"'
    );
    expect(patcher).not.toContain('plugin/src/');
  });

  it('pins APN, FCM, and no-push output and does not invent absent no-push seats', () => {
    const apn = read(patchedRoot, 'variants/apn/AppDelegate.swift');
    const fcm = read(patchedRoot, 'variants/fcm/AppDelegate.swift');
    const noPush = read(patchedRoot, 'variants/nopush/AppDelegate.swift');
    const apnConfig = JSON.parse(read(patchedRoot, 'variants/apn/app.json'));
    const fcmConfig = JSON.parse(read(patchedRoot, 'variants/fcm/app.json'));
    const noPushConfig = JSON.parse(
      read(patchedRoot, 'variants/nopush/app.json')
    );
    expect(fcm).toBe(apn);
    expect(apnConfig.expo.plugins[2][1].ios.pushNotification.provider).toBe(
      'apn'
    );
    expect(fcmConfig.expo.plugins[2][1].ios.pushNotification.provider).toBe(
      'fcm'
    );
    expect(noPushConfig.expo.plugins[2][1].ios).not.toHaveProperty(
      'pushNotification'
    );
    expect(noPush).toContain('"application.did-finish-launching"');
    expect(noPush).toContain('"application.open-url"');
    expect(noPush).toContain('"application.continue-user-activity"');
    expect(noPush).not.toContain(
      '"application.did-register-for-remote-notifications"'
    );
    expect(noPush).not.toContain(
      '"application.did-fail-to-register-for-remote-notifications"'
    );
    expect(noPush).not.toContain('"customerio.route-deep-link"');
  });

  it('emits a Customer.io token terminal only when the optional SDK receiver exists', () => {
    const apn = read(patchedRoot, 'customerio-ios/apn/CioAppDelegateAPN.swift');
    const fcm = read(patchedRoot, 'customerio-ios/fcm/CioAppDelegateFCM.swift');
    expect(apn).toContain('if let messagingPushAPN {');
    expect(apn).toContain(
      'messagingPushAPN.registerDeviceToken(apnDeviceToken: deviceToken)'
    );
    expect(apn).not.toContain('messagingPushAPN?.registerDeviceToken');
    expect(fcm).toContain('if let messagingPushFCM {');
    expect(fcm).toContain(
      'messagingPushFCM.registerDeviceToken(fcmToken: token)'
    );
    expect(fcm).not.toContain('messagingPushFCM?.registerDeviceToken');
  });

  it('does not invent Expo scene or quick-action host callbacks', () => {
    const allPatched = Object.keys(
      JSON.parse(read(patchedRoot, 'PROVENANCE.json')).files
    )
      .map((relative) => read(patchedRoot, relative))
      .join('\n');
    expect(allPatched).not.toContain('UISceneDelegate');
    expect(allPatched).not.toContain('scene.open-url-contexts');
    expect(allPatched).not.toContain('application.perform-quick-action"');
  });

  it('leaves the known EXNotifications compatibility gap untouched', () => {
    const apnHandler = fs.readFileSync(
      path.join(
        repoRoot,
        'plugin/src/helpers/native-files/ios/apn/CioSdkAppDelegateHandler.swift'
      ),
      'utf8'
    );
    expect(apnHandler).toContain('#if canImport(EXNotifications)');
    expect(apnHandler).not.toContain('canImport(ExpoNotifications)');
  });
});

describe('actual Expo JavaScript receipt seats', () => {
  const receipts = fs.readFileSync(
    path.join(repoRoot, 'lifecycle-fixture/javascript/LifecycleReceipts.ts'),
    'utf8'
  );

  it('uses only Notifications, Linking, and AppState receipt APIs', () => {
    expect(receipts).toContain('Notifications.addNotificationReceivedListener');
    expect(receipts).toContain('trigger?.payload ? trigger.payload : data');
    expect(receipts).toContain(
      'Notifications.addNotificationResponseReceivedListener'
    );
    expect(receipts).toContain(
      'Notifications.getLastNotificationResponseAsync()'
    );
    expect(receipts).toContain("Linking.addEventListener('url'");
    expect(receipts).toContain('Linking.getInitialURL()');
    expect(receipts).toContain("AppState.addEventListener('change'");
    expect(receipts).not.toContain('quick-action');
    expect(receipts).not.toContain('scene.');
  });

  it('gates cold pulls separately from warm listeners', () => {
    expect(receipts).toContain("scenario === 'push-tap-warm'");
    expect(receipts).toContain("scenario === 'push-tap-cold'");
    expect(receipts).toContain("scenario === 'custom-url-warm'");
    expect(receipts).toContain("scenario === 'custom-url-cold'");
    expect(receipts).not.toContain('warmSeen');
    expect(receipts).not.toContain('dedup');
  });

  it('requires harness-issued identity and never mints IDs', () => {
    expect(receipts).toContain('javascriptStreamId: string');
    expect(receipts).toContain(
      'getNativeReceipt(): Record<string, unknown> | null'
    );
    expect(receipts).toContain('writeJavascriptTrace(line: string): boolean');
    expect(receipts).toContain('writeJavascriptReceipt(json: string): boolean');
    expect(receipts).toContain('if (finishStarted) return');
    expect(receipts).toContain(
      'recorder.end().then(() => waitForNativeReceipt(module))'
    );
    expect(receipts).not.toContain('module.endScenario');
    expect(receipts).toContain('main_thread: false');
    expect(receipts).not.toContain('randomUUID');
    expect(receipts).not.toContain('uuid');
    expect(receipts).not.toContain('Math.random');
  });
});

describe('real generated-app capture validation', () => {
  const harness = fs.readFileSync(
    path.join(scriptsRoot, 'validate-expo-runtime-capture.py'),
    'utf8'
  );

  it('binds L2/L3 manifests to the dirty outer tree and exact generated sources', () => {
    expect(harness).toContain('"ls-files", "-z", "--cached", "--others"');
    expect(harness).toContain('diff + b"\\0UNTRACKED\\0"');
    expect(harness).toContain(
      'generated source differs from its pinned patched snapshot'
    );
    expect(harness).toContain(
      'manifest does not record the exact current Expo source snapshot'
    );
    expect(harness).toContain(
      'runtime acceptance validation requires L2 or L3'
    );
  });

  it('requires native and JavaScript post-drain receipts when those streams exist', () => {
    expect(harness).toContain(
      'receipt does not match exactly one manifest stream'
    );
    expect(harness).toContain(
      'JavaScript stream requires trace and receipt files'
    );
    expect(harness).toContain(
      'canonical validator rejected the runtime capture'
    );
  });

  it('derives generated dependency versions and requires an explicit validator runtime', () => {
    expect(harness).toContain('generated package-lock.json');
    expect(harness).toContain('generated Podfile.lock');
    expect(harness).toContain(
      'ExpoAppDelegateSubscriberManager.swift in Sources'
    );
    expect(harness).toContain('ExpoModulesCore.xcframework');
    expect(harness).toContain('FirebaseMessaging');
    expect(harness).toContain('_validate_dependency_manifest');
    expect(harness).toContain('_verify_contract_bundle');
    expect(harness).toContain('ios27_lifecycle_contract.py');
    expect(harness).toContain('--validator-python');
    expect(harness).not.toContain('sys.executable');
  });
});
