// eslint-disable-next-line @typescript-eslint/no-require-imports
const xcode = require('xcode');
import {
  addLiveActivityWidgetToXcodeProject,
  type AddLiveActivityWidgetTargetOptions,
} from '../../../plugin/src/ios/withCioLiveActivityWidgetXcodeProject';
import { getFixturePath } from '../../utils';

const WIDGET_TARGET_NAME = 'CIOLiveActivityWidget';

const loadFixture = (name: string): { project: ReturnType<typeof xcode.project> } => {
  const project = xcode.project(getFixturePath('ios/pbxproj', name));
  project.parseSync();
  return { project };
};

const targetNames = (project: ReturnType<typeof xcode.project>): string[] =>
  Object.values(project.pbxNativeTargetSection())
    .filter(
      (t): t is { name: string } =>
        typeof t === 'object' && t !== null && 'name' in (t as object),
    )
    .map((t) => (t.name as string).replace(/"/g, ''));

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

const baseOptions: AddLiveActivityWidgetTargetOptions = {
  appleTeamId: 'TESTTEAM1',
  bundleIdentifier: 'io.customer.testbed.expo',
};

describe('ios scenarios — addLiveActivityWidgetToXcodeProject (vanilla pbxproj)', () => {
  it('adds the widget target alongside the existing host-app target', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    expect(targetNames(project)).toEqual(['ExpoTestbed']);

    addLiveActivityWidgetToXcodeProject(project, baseOptions);

    expect(targetNames(project).sort()).toEqual([
      'CIOLiveActivityWidget',
      'ExpoTestbed',
    ]);
  });

  it('wires three build phases (Sources, Resources, Frameworks) on the new target', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addLiveActivityWidgetToXcodeProject(project, baseOptions);

    expect(buildPhaseTypesForTarget(project, WIDGET_TARGET_NAME).sort()).toEqual([
      'PBXFrameworksBuildPhase',
      'PBXResourcesBuildPhase',
      'PBXSourcesBuildPhase',
    ]);
  });

  it('configures dev team, 16.2 deployment target (default), Swift 5.0, and prefixed bundle id', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addLiveActivityWidgetToXcodeProject(project, baseOptions);

    const settings = Object.values(buildSettingsForTarget(project, WIDGET_TARGET_NAME));
    expect(settings.length).toBeGreaterThan(0);
    for (const buildSettings of settings) {
      expect(buildSettings).toMatchObject({
        DEVELOPMENT_TEAM: 'TESTTEAM1',
        IPHONEOS_DEPLOYMENT_TARGET: '16.2',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_STYLE: 'Automatic',
        SWIFT_VERSION: '5.0',
      });
      // App extension bundle id must be prefixed by the host app's bundle id.
      expect(String(buildSettings.PRODUCT_BUNDLE_IDENTIFIER)).toContain(
        'io.customer.testbed.expo.CIOLiveActivityWidget',
      );
    }
  });

  it('honors an explicit deployment target override', () => {
    const { project } = loadFixture('vanilla.pbxproj');
    addLiveActivityWidgetToXcodeProject(project, {
      ...baseOptions,
      iosDeploymentTarget: '17.2',
    });

    const settings = Object.values(buildSettingsForTarget(project, WIDGET_TARGET_NAME));
    for (const buildSettings of settings) {
      expect(buildSettings.IPHONEOS_DEPLOYMENT_TARGET).toEqual('17.2');
    }
  });
});

describe('ios scenarios — addLiveActivityWidgetToXcodeProject (multi-target host)', () => {
  it('adds the widget target without disturbing other pre-existing extension targets', () => {
    const { project } = loadFixture('multi_target.pbxproj');
    expect(targetNames(project).sort()).toEqual(['ExpoTestbed', 'Watch']);

    addLiveActivityWidgetToXcodeProject(project, baseOptions);

    expect(targetNames(project).sort()).toEqual([
      'CIOLiveActivityWidget',
      'ExpoTestbed',
      'Watch',
    ]);
  });

  it('leaves other targets untouched (no DEVELOPMENT_TEAM stamp on Watch)', () => {
    const { project } = loadFixture('multi_target.pbxproj');
    addLiveActivityWidgetToXcodeProject(project, baseOptions);

    const watchSettings = Object.values(buildSettingsForTarget(project, 'Watch'));
    expect(watchSettings.length).toBeGreaterThan(0);
    for (const buildSettings of watchSettings) {
      expect(buildSettings.DEVELOPMENT_TEAM).toBeUndefined();
    }
  });
});
