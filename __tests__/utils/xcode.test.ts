// eslint-disable-next-line @typescript-eslint/no-require-imports
const xcode = require('xcode');
import { copyFileToXcode, getOrCreateCustomerIOGroup } from '../../plugin/src/utils/xcode';
import { getFixturePath } from '../utils';

jest.mock('../../plugin/src/helpers/utils/fileManagement', () => ({
  FileManagement: {
    readFile: jest.fn(() => 'source contents'),
    writeFile: jest.fn(),
  },
}));

const PROJECT_NAME = 'ExpoTestbed';

type Project = ReturnType<typeof xcode.project>;

const loadProject = (name = 'vanilla'): Project => {
  const project = xcode.project(getFixturePath('ios/pbxproj', `${name}.pbxproj`));
  project.parseSync();
  return project;
};

// Delete the fixture's pre-existing CustomerIO group (object + comment entries) so the
// create branch runs.
const removeCustomerIOGroup = (project: Project): void => {
  const groups = project.hash.project.objects.PBXGroup;
  for (const key of Object.keys(groups)) {
    const value = groups[key];
    const isComment = value === 'CustomerIO';
    const isGroup = value && typeof value === 'object' && value.name === 'CustomerIO';
    if (isComment || isGroup) {
      delete groups[key];
    }
  }
};

describe('getOrCreateCustomerIOGroup', () => {
  // Regression for the object-vs-key bug: the existing-group branch must return the group KEY,
  // not the group object. Passing the object to addSourceFile crashes on pbxproj files without a
  // PBXVariantGroup section (Expo SDK 55). withCIOIosSwift's test mocks this helper, so it can't
  // catch a regression here.
  it('returns the existing CustomerIO group key, not the object', () => {
    const project = loadProject();
    const result = getOrCreateCustomerIOGroup(project, PROJECT_NAME);
    expect(typeof result).toBe('string');
    expect(project.getPBXGroupByKey(result)?.name).toBe('CustomerIO');
  });

  it('creates the CustomerIO group and returns its key when none exists', () => {
    const project = loadProject();
    removeCustomerIOGroup(project);
    expect(project.pbxGroupByName('CustomerIO')).toBeFalsy();

    const result = getOrCreateCustomerIOGroup(project, PROJECT_NAME);
    expect(typeof result).toBe('string');
    expect(project.getPBXGroupByKey(result)?.name).toBe('CustomerIO');
  });
});

describe('copyFileToXcode', () => {
  it('passes the CustomerIO group key (not object) to addSourceFile', () => {
    const project = loadProject();
    const addSourceFile = jest
      .spyOn(project, 'addSourceFile')
      .mockImplementation(() => ({}));
    const groupKey = getOrCreateCustomerIOGroup(project, PROJECT_NAME);

    copyFileToXcode({
      xcodeProject: project,
      iosProjectRoot: '/tmp/ios',
      projectName: PROJECT_NAME,
      sourceFilePath: '/tmp/Src.swift',
      targetFileName: 'Src.swift',
      transform: (content) => content,
      customerIOGroup: groupKey,
    });

    expect(addSourceFile).toHaveBeenCalledWith('ExpoTestbed/Src.swift', null, groupKey);
    expect(typeof addSourceFile.mock.calls[0][2]).toBe('string');
  });
});
