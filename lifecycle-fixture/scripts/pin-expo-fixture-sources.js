const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { assertSafeContainedPath } = require('./lib');

// Pins the exact upstream iOS lifecycle sources the MBL-2232 fixture and its
// tests reason about, straight out of an installed Expo app. The pinned copies
// are the evidence base: probe signatures and callback-ownership claims are
// asserted against these files, never against remembered API shapes.
//
// Usage:
//   node lifecycle-fixture/scripts/pin-expo-fixture-sources.js --app-path=ci-test-apps/LifecycleFixture_Expo57
//
// Output tree (committed):
//   __tests__/fixtures/ios/expo57-generated/
//     PROVENANCE.json            versions + sha256 per file + commands used
//     expo/…                     ExpoAppDelegate + subscriber loader + template
//     expo-modules-core/…        subscriber protocol/manager/repository
//     expo-notifications/…       notification-center delegate machinery
//
// Unlike the hand-curated fixtures next door (see TESTING.md), these files are
// deliberately generated verbatim: MBL-2232 requires the real source of the
// current SDK, not a curated approximation. Regenerate by re-running this
// script against a freshly created app; the test suite recomputes the hashes.

const REPO_ROOT = path.resolve(__dirname, '../..');
const GENERATED_FIXTURE_ROOT = path.join(REPO_ROOT, 'ci-test-apps');
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  '__tests__/fixtures/ios/expo57-generated'
);

// Files pinned per package: repo-relative destination -> app-relative source.
const PINNED_SOURCES = {
  'expo/ExpoAppDelegate.swift':
    'node_modules/expo/ios/AppDelegates/ExpoAppDelegate.swift',
  'expo/Expo.podspec': 'node_modules/expo/Expo.podspec',
  'expo/EXAppDelegatesLoader.m':
    'node_modules/expo/ios/AppDelegates/EXAppDelegatesLoader.m',
  'expo/AppDelegatesLoaderDelegate.swift':
    'node_modules/expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift',
  'expo-modules-core/ExpoAppDelegateSubscriber.swift':
    'node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriber.swift',
  'expo-modules-core/ExpoAppDelegateSubscriberManager.swift':
    'node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift',
  'expo-modules-core/ExpoAppDelegateSubscriberRepository.swift':
    'node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberRepository.swift',
  'expo-modules-core/ExpoModulesCore.podspec':
    'node_modules/expo-modules-core/ExpoModulesCore.podspec',
  'expo-notifications/NotificationCenterManager.swift':
    'node_modules/expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift',
  'expo-notifications/NotificationsAppDelegateSubscriber.swift':
    'node_modules/expo-notifications/ios/ExpoNotifications/Notifications/NotificationsAppDelegateSubscriber.swift',
  'expo-notifications/EmitterModule.swift':
    'node_modules/expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift',
  'expo-notifications/ExpoNotifications.podspec':
    'node_modules/expo-notifications/ios/ExpoNotifications.podspec',
  'expo-notifications/expo-module.config.json':
    'node_modules/expo-notifications/expo-module.config.json',
  'generated-app/Podfile.properties.json': 'ios/Podfile.properties.json',
};

// The prebuild template ships inside expo/template.tgz; extracted separately.
const PINNED_TEMPLATE_SOURCES = {
  'expo/template/AppDelegate.swift': 'package/ios/HelloWorld/AppDelegate.swift',
  'expo/template/Info.plist': 'package/ios/HelloWorld/Info.plist',
};

const PINNED_OPTIONAL_POD_SOURCES = {
  'customerio-ios/CioNotificationCenterDelegate.swift':
    'ios/Pods/CustomerIOMessagingPush/Sources/MessagingPush/Integration/CioNotificationCenterDelegate.swift',
  'customerio-ios/CioAppDelegateAPN.swift':
    'ios/Pods/CustomerIOMessagingPushAPN/Sources/MessagingPushAPN/Integration/CioAppDelegateAPN.swift',
  'customerio-ios/CioAppDelegateFCM.swift':
    'ios/Pods/CustomerIOMessagingPushFCM/Sources/MessagingPushFCM/Integration/CioAppDelegateFCM.swift',
};

const VERSIONED_PACKAGES = [
  'expo',
  'expo-modules-core',
  'expo-notifications',
  'react-native',
  'customerio-reactnative',
  'customerio-expo-plugin',
];

const EXPECTED_VERSIONS = {
  'expo': '57.0.12',
  'expo-modules-core': '57.0.10',
  'expo-notifications': '57.0.10',
  'react-native': '0.86.2',
  'customerio-reactnative': '6.6.2',
  'customerio-expo-plugin': '3.7.1',
};

function getArgValue(name) {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function main() {
  const appPathArg = getArgValue('--app-path');
  if (!appPathArg) {
    console.error('Missing required --app-path=<generated expo app>');
    process.exit(1);
  }
  assertSafeContainedPath(REPO_ROOT, GENERATED_FIXTURE_ROOT, {
    label: 'generated fixture root',
  });
  assertSafeContainedPath(REPO_ROOT, OUTPUT_ROOT, {
    label: 'pinned source output root',
  });
  assertSafeContainedPath(
    REPO_ROOT,
    path.join(__dirname, 'expo57-source-patch.lock.json'),
    { label: 'fixture patch lock' }
  );
  const appPath = fs.realpathSync(path.resolve(REPO_ROOT, appPathArg));
  const generatedFixtureRoot = fs.realpathSync(GENERATED_FIXTURE_ROOT);
  const relativeAppPath = path.relative(generatedFixtureRoot, appPath);
  if (
    relativeAppPath === '' ||
    relativeAppPath === '..' ||
    relativeAppPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeAppPath)
  ) {
    throw new Error('Refusing to pin outside ci-test-apps');
  }
  assertSafeContainedPath(generatedFixtureRoot, appPath, {
    label: 'generated Expo fixture',
  });
  const patchLock = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'expo57-source-patch.lock.json'),
      'utf8'
    )
  );

  const packageVersions = {};
  for (const pkg of VERSIONED_PACKAGES) {
    const pkgJsonPath = assertSafeContainedPath(
      appPath,
      path.join(appPath, 'node_modules', pkg, 'package.json'),
      { label: `${pkg} package metadata` }
    );
    packageVersions[pkg] = fs.existsSync(pkgJsonPath)
      ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version
      : null;
  }
  for (const [pkg, expected] of Object.entries(EXPECTED_VERSIONS)) {
    if (packageVersions[pkg] !== expected) {
      throw new Error(
        `${pkg}: expected ${expected}, found ${packageVersions[pkg]}`
      );
    }
  }

  const files = {};
  const writePinned = (destRelative, contents) => {
    const destPath = path.join(OUTPUT_ROOT, destRelative);
    assertSafeContainedPath(OUTPUT_ROOT, destPath, {
      allowMissing: true,
      label: `pinned source ${destRelative}`,
    });
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    assertSafeContainedPath(OUTPUT_ROOT, destPath, {
      allowMissing: true,
      label: `pinned source ${destRelative}`,
    });
    if (fs.existsSync(destPath)) fs.chmodSync(destPath, 0o644);
    assertSafeContainedPath(OUTPUT_ROOT, destPath, {
      allowMissing: true,
      label: `pinned source ${destRelative}`,
    });
    fs.writeFileSync(destPath, contents);
    files[destRelative] = { sha256: sha256(contents) };
  };

  for (const [dest, src] of Object.entries(PINNED_SOURCES)) {
    const sourcePath = assertSafeContainedPath(
      appPath,
      path.join(appPath, src),
      { label: `generated source ${src}` }
    );
    const bytes = fs.readFileSync(sourcePath);
    const patchEntry = Object.values(patchLock.files).find(
      (entry) => entry.path === src
    );
    if (patchEntry && !patchEntry.preSha256.includes(sha256(bytes))) {
      throw new Error(
        `${src}: pinning requires the exact unpatched Expo 57 source`
      );
    }
    writePinned(dest, bytes);
  }

  for (const [dest, src] of Object.entries(PINNED_OPTIONAL_POD_SOURCES)) {
    const sourcePath = path.join(appPath, src);
    const previouslyPinnedPath = path.join(OUTPUT_ROOT, dest);
    // APN and FCM are mutually exclusive CocoaPods variants. Preserve an
    // earlier exact pre-patch pin when the current generated app does not
    // install that provider-specific source.
    const bytes = fs.existsSync(sourcePath)
      ? fs.readFileSync(
          assertSafeContainedPath(appPath, sourcePath, {
            label: `generated optional pod source ${src}`,
          })
        )
      : fs.existsSync(previouslyPinnedPath)
      ? fs.readFileSync(
          assertSafeContainedPath(OUTPUT_ROOT, previouslyPinnedPath, {
            label: `previously pinned optional pod source ${dest}`,
          })
        )
      : null;
    if (!bytes) continue;
    const entry = Object.values(patchLock.files).find(
      (candidate) => candidate.path === src
    );
    if (!entry || !entry.preSha256.includes(sha256(bytes))) {
      throw new Error(
        `${src}: pinning requires the exact unpatched pod source`
      );
    }
    writePinned(dest, bytes);
  }

  const templateTgz = assertSafeContainedPath(
    appPath,
    path.join(appPath, 'node_modules/expo/template.tgz'),
    { label: 'Expo template archive' }
  );
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-expo-template-'));
  try {
    execFileSync(
      'tar',
      [
        '-xzf',
        templateTgz,
        '-C',
        tmpDir,
        ...Object.values(PINNED_TEMPLATE_SOURCES),
      ],
      { stdio: 'pipe' }
    );
    for (const [dest, src] of Object.entries(PINNED_TEMPLATE_SOURCES)) {
      const extractedPath = assertSafeContainedPath(
        tmpDir,
        path.join(tmpDir, src),
        { label: `extracted Expo template source ${src}` }
      );
      writePinned(dest, fs.readFileSync(extractedPath));
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const provenance = {
    ticket: 'MBL-2232',
    generatedBy: 'lifecycle-fixture/scripts/pin-expo-fixture-sources.js',
    appPath: path.relative(REPO_ROOT, appPath),
    commands: [
      'node scripts/compatibility/create-test-app.js --expo-version=57 --app-name=LifecycleFixture_Expo57',
      'node scripts/compatibility/setup-test-app.js --app-path=ci-test-apps/LifecycleFixture_Expo57 --dependencies=expo-notifications',
      `node lifecycle-fixture/scripts/pin-expo-fixture-sources.js --app-path=${path.relative(
        REPO_ROOT,
        appPath
      )}`,
    ],
    packageVersions,
    files,
  };
  const localInputs = [
    'tsconfig.json',
    'tsconfig.build.json',
    'scripts/compatibility/configure-plugin.js',
    'lifecycle-fixture/javascript/LifecycleReceipts.ts',
    'lifecycle-fixture/javascript/runtime-modules.d.ts',
    'lifecycle-fixture/javascript/tsconfig.json',
    'lifecycle-fixture/probe-module/expo-module.config.json',
    'lifecycle-fixture/probe-module/ios/CioLifecycleProbe.podspec',
    'lifecycle-fixture/probe-module/ios/CioLifecycleProbeBootstrap.m',
    'lifecycle-fixture/probe-module/ios/CioLifecycleProbeModule.swift',
    'lifecycle-fixture/probe-module/ios/LifecycleTraceEvidence.swift',
    'lifecycle-fixture/probe-module/ios/LifecycleTraceModel.swift',
    'lifecycle-fixture/probe-module/ios/LifecycleTraceProbe.swift',
    'lifecycle-fixture/probe-module/ios/LifecycleTraceProbeObserver.swift',
    'lifecycle-fixture/probe-module/ios/LifecycleTraceRecorder.swift',
    'lifecycle-fixture/scripts/expo57-source-patch.lock.json',
    'lifecycle-fixture/scripts/install-probe.js',
    'lifecycle-fixture/scripts/lib.js',
    'lifecycle-fixture/scripts/patch-customerio-pod-sources.js',
    'lifecycle-fixture/scripts/patch-expo57-sources.js',
    'lifecycle-fixture/scripts/pin-expo-fixture-sources.js',
    'lifecycle-fixture/scripts/test-javascript-recorder.js',
    'lifecycle-fixture/scripts/test-expo-producer-captures.py',
    'lifecycle-fixture/scripts/test-expo-runtime-capture.py',
    'lifecycle-fixture/scripts/typecheck-probe.sh',
    'lifecycle-fixture/scripts/validate-expo-runtime-capture.py',
  ];
  provenance.localInputs = Object.fromEntries(
    localInputs.map((relative) => {
      const inputPath = assertSafeContainedPath(
        REPO_ROOT,
        path.join(REPO_ROOT, relative),
        { label: `local fixture input ${relative}` }
      );
      const bytes = fs.readFileSync(inputPath);
      return [relative, { sha256: sha256(bytes) }];
    })
  );
  const provenancePath = assertSafeContainedPath(
    OUTPUT_ROOT,
    path.join(OUTPUT_ROOT, 'PROVENANCE.json'),
    { allowMissing: true, label: 'pinned source provenance' }
  );
  assertSafeContainedPath(OUTPUT_ROOT, provenancePath, {
    allowMissing: true,
    label: 'pinned source provenance',
  });
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');

  console.log(
    `Pinned ${Object.keys(files).length} files to ${path.relative(
      REPO_ROOT,
      OUTPUT_ROOT
    )}`
  );
  console.log(JSON.stringify(packageVersions, null, 2));
}

main();
