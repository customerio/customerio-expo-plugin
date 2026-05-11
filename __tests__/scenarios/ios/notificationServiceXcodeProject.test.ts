// eslint-disable-next-line @typescript-eslint/no-require-imports
const xcode = require('xcode');
import {
  addNotificationServiceExtensionToXcodeProject,
  type AddNseTargetToXcodeProjectOptions,
} from '../../../plugin/src/ios/withNotificationsXcodeProject';
import { getFixturePath } from '../../utils';

const NSE_TARGET_NAME = 'NotificationService';

const loadFixture = (name: string): { project: ReturnType<typeof xcode.project> } => {
  const project = xcode.project(getFixturePath('ios/pbxproj', name));
  project.parseSync();
  return { project };
};

// `pbxTargetByName` does a literal string compare, but `addTarget` stores names
// quoted (e.g. `"NotificationService"`), so a lookup by the unquoted form
// returns undefined. Use the quoted form (or scan the section directly) when we
// need to actually find a target the helper added. This applies to test code
// only; the helper's own idempotency check uses the unquoted form (see
// "behavior finding" below).
const findTarget = (
  project: ReturnType<typeof xcode.project>,
  name: string,
): { name: string; buildPhases: { value: string; comment?: string }[] } | undefined => {
  const targets = project.pbxNativeTargetSection();
  for (const key of Object.keys(targets)) {
    const t = targets[key];
    if (typeof t !== 'object' || t === null || !('name' in (t as object))) continue;
    if ((t.name as string).replace(/"/g, '') === name) return t;
  }
  return undefined;
};

const targetNames = (project: ReturnType<typeof xcode.project>): string[] =>
  Object.values(project.pbxNativeTargetSection())
    .filter(
      (t): t is { name: string } =>
        typeof t === 'object' && t !== null && 'name' in (t as object),
    )
    .map((t) => (t.name as string).replace(/"/g, ''));

const buildPhaseTypesForTarget = (
  project: ReturnType<typeof xcode.project>,
  targetName: string,
): string[] => {
  const target = findTarget(project, targetName);
  if (!target) return [];
  const sections = project.hash.project.objects;
  return target.buildPhases.map((bp) => {
    for (const phaseType of [
      'PBXSourcesBuildPhase',
      'PBXResourcesBuildPhase',
      'PBXFrameworksBuildPhase',
    ]) {
      if (sections[phaseType]?.[bp.value]) return phaseType;
    }
    return 'unknown';
  });
};

const buildSettingsForTarget = (
  project: ReturnType<typeof xcode.project>,
  targetName: string,
): Record<string, Record<string, unknown>> => {
  const configurations = project.pbxXCBuildConfigurationSection();
  const out: Record<string, Record<string, unknown>> = {};
  for (const key in configurations) {
    const config = configurations[key];
    if (
      typeof config === 'object' &&
      config?.buildSettings?.PRODUCT_NAME === `"${targetName}"`
    ) {
      out[config.name] = config.buildSettings;
    }
  }
  return out;
};

const baseOptions: AddNseTargetToXcodeProjectOptions = {
  appleTeamId: 'TESTTEAM1',
  bundleIdentifier: 'io.customer.testbed.expo',
};

describe('ios scenarios — addNotificationServiceExtensionToXcodeProject (vanilla pbxproj)', () => {
  it('adds the NotificationService target alongside the existing host-app target', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    expect(targetNames(project)).toEqual(['ExpoTestbed']);

    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    expect(targetNames(project).sort()).toEqual(['ExpoTestbed', 'NotificationService']);
  });

  it('wires three build phases (Sources, Resources, Frameworks) on the new target', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    expect(buildPhaseTypesForTarget(project, NSE_TARGET_NAME).sort()).toEqual([
      'PBXFrameworksBuildPhase',
      'PBXResourcesBuildPhase',
      'PBXSourcesBuildPhase',
    ]);
  });

  it('configures the new target with the development team, deployment target, and Swift version', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, {
      ...baseOptions,
      iosDeploymentTarget: '14.0',
    });

    const settings = Object.values(buildSettingsForTarget(project, NSE_TARGET_NAME));
    expect(settings.length).toBeGreaterThan(0);
    for (const buildSettings of settings) {
      expect(buildSettings).toMatchObject({
        DEVELOPMENT_TEAM: 'TESTTEAM1',
        IPHONEOS_DEPLOYMENT_TARGET: '14.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_STYLE: 'Automatic',
        SWIFT_VERSION: 4.2,
      });
      expect(buildSettings.CODE_SIGN_ENTITLEMENTS).toBeUndefined();
    }
  });

  it('falls back to "15.1" when iosDeploymentTarget is not provided', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    const settings = Object.values(buildSettingsForTarget(project, NSE_TARGET_NAME));
    for (const buildSettings of settings) {
      expect(buildSettings.IPHONEOS_DEPLOYMENT_TARGET).toEqual('15.1');
    }
  });

  it('sets CODE_SIGN_ENTITLEMENTS only when appGroupId is configured', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, {
      ...baseOptions,
      appGroupId: 'group.io.customer.testbed.expo.apn.cio',
    });

    const settings = Object.values(buildSettingsForTarget(project, NSE_TARGET_NAME));
    for (const buildSettings of settings) {
      expect(buildSettings.CODE_SIGN_ENTITLEMENTS).toEqual(
        'NotificationService/NotificationService.entitlements',
      );
    }
  });

  // Regression for #350: the legacy-bug workaround initialized
  // PBXTargetDependency and PBXContainerItemProxy with the SAME object
  // reference (a one-character typo aliased proxy to the dependency bucket).
  // The legacy serializer tolerated the resulting orphan proxy entries,
  // but Expo SDK 55+ strict @bacons/xcode serializer crashes when it walks
  // the project and finds a PBXTargetDependency.targetProxy UUID that has
  // no entry in PBXContainerItemProxy.
  it('initializes PBXTargetDependency and PBXContainerItemProxy as distinct objects, so addTarget populates both buckets independently', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    const objects = project.hash.project.objects;
    const dependency = objects.PBXTargetDependency;
    const proxy = objects.PBXContainerItemProxy;

    expect(dependency).toBeDefined();
    expect(proxy).toBeDefined();
    // If aliased, the two buckets share an object reference and every
    // proxy entry shows up as a dependency entry (and vice versa).
    expect(proxy).not.toBe(dependency);

    // Every PBXTargetDependency entry references a UUID via targetProxy;
    // that UUID must resolve inside PBXContainerItemProxy. With the typo,
    // the proxy bucket is the same object as the dependency bucket, so
    // the lookup finds a PBXTargetDependency record (which has no isa of
    // PBXContainerItemProxy) and the strict serializer rejects it.
    const dependencyEntries = Object.entries(dependency as Record<string, unknown>)
      .filter(([key]) => !key.endsWith('_comment'))
      .map(([, value]) => value)
      .filter(
        (value): value is { isa: string; targetProxy: string } =>
          typeof value === 'object' &&
          value !== null &&
          (value as { isa?: string }).isa === 'PBXTargetDependency',
      );
    expect(dependencyEntries.length).toBeGreaterThan(0);
    for (const entry of dependencyEntries) {
      const referenced = (proxy as Record<string, unknown>)[entry.targetProxy];
      expect(referenced).toBeDefined();
      expect((referenced as { isa: string }).isa).toEqual('PBXContainerItemProxy');
    }
  });
});

// Behavior finding (do NOT change in this refactor): the helper's early-exit
// guard `if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME))` was
// extracted from the original wrapper as-is, but `pbxTargetByName` does a
// literal string compare — and `addTarget` stores names wrapped in quotes
// (`"NotificationService"`). So the unquoted lookup never matches a target
// that was added via this helper, and re-applying the helper to a project
// that already has the NSE target will append a duplicate. Production prebuild
// avoids this in practice because `expo prebuild --clean` regenerates the
// project from scratch every run, but the latent bug is real.
//
// The tests below capture the current (buggy) behavior so a future refactor
// PR that fixes the guard will see the assertions flip and can update them
// in one place.
describe('ios scenarios — addNotificationServiceExtensionToXcodeProject (idempotency — current behavior, see comment above)', () => {
  it('re-applies and adds a duplicate NSE target to a project that already has one (latent bug)', () => {
    const { project } = loadFixture('with_existing_nse.pbxproj');
    expect(targetNames(project).filter((n) => n === NSE_TARGET_NAME).length).toEqual(1);

    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    // Bug: the unquoted-name guard misses the existing target. Re-applying
    // produces a duplicate. A follow-up refactor should fix the guard.
    expect(targetNames(project).filter((n) => n === NSE_TARGET_NAME).length).toEqual(2);
  });
});

describe('ios scenarios — addNotificationServiceExtensionToXcodeProject (multi-target host)', () => {
  it('adds the NSE target without disturbing other pre-existing extension targets', () => {
    const { project } = loadFixture('multi_target.pbxproj');
    expect(targetNames(project).sort()).toEqual(['ExpoTestbed', 'Watch']);

    addNotificationServiceExtensionToXcodeProject(project, baseOptions);

    expect(targetNames(project).sort()).toEqual([
      'ExpoTestbed',
      'NotificationService',
      'Watch',
    ]);
  });

  it('configures build settings on the new NSE target only, leaving other targets alone', () => {
    const { project } = loadFixture('multi_target.pbxproj');
    addNotificationServiceExtensionToXcodeProject(project, {
      ...baseOptions,
      appGroupId: 'group.io.customer.testbed.expo.apn.cio',
    });

    // NSE target gets entitlements set
    const nseSettings = Object.values(buildSettingsForTarget(project, NSE_TARGET_NAME));
    expect(nseSettings.length).toBeGreaterThan(0);
    for (const buildSettings of nseSettings) {
      expect(buildSettings.CODE_SIGN_ENTITLEMENTS).toEqual(
        'NotificationService/NotificationService.entitlements',
      );
    }

    // Watch target is untouched (no DEVELOPMENT_TEAM stamp from the helper)
    const watchSettings = Object.values(buildSettingsForTarget(project, 'Watch'));
    expect(watchSettings.length).toBeGreaterThan(0);
    for (const buildSettings of watchSettings) {
      expect(buildSettings.DEVELOPMENT_TEAM).toBeUndefined();
      expect(buildSettings.CODE_SIGN_ENTITLEMENTS).toBeUndefined();
    }
  });
});
