import {
  buildHostAppPodSnippet,
  type InjectCIOPodfileOptions,
} from '../../plugin/src/helpers/utils/injectCIOPodfileCode';

jest.mock('../../plugin/src/utils/logger', () => ({ logger: {} }));
jest.mock('../../plugin/src/helpers/constants/ios', () => ({
  getRelativePathToRNSDK: () => '../node_modules/customerio-reactnative',
}));
jest.mock('../../plugin/src/helpers/utils/codeInjection', () => ({
  injectCodeByRegex: () => [],
}));
jest.mock('../../plugin/src/helpers/utils/fileManagement', () => ({
  FileManagement: {},
}));

const IOS_PATH = '/fake/project/ios';

describe('buildHostAppPodSnippet', () => {
  it('returns single-subspec pod line when locationEnabled is false', () => {
    expect(
      buildHostAppPodSnippet(IOS_PATH, false, { locationEnabled: false })
    ).toBe(
      "pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'"
    );
    expect(
      buildHostAppPodSnippet(IOS_PATH, true, { locationEnabled: false })
    ).toBe(
      "pod 'customerio-reactnative/fcm', :path => '../node_modules/customerio-reactnative'"
    );
  });

  it('returns single-subspec pod line when options are omitted', () => {
    expect(buildHostAppPodSnippet(IOS_PATH, false)).toBe(
      "pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'"
    );
    expect(buildHostAppPodSnippet(IOS_PATH, true)).toBe(
      "pod 'customerio-reactnative/fcm', :path => '../node_modules/customerio-reactnative'"
    );
  });

  it('returns subspecs with fcm and location when locationEnabled and hasPush', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: true,
    };
    expect(buildHostAppPodSnippet(IOS_PATH, true, options)).toBe(
      "pod 'customerio-reactnative', :subspecs => ['fcm', 'location'], :path => '../node_modules/customerio-reactnative'"
    );
  });

  it('returns subspecs with apn and location when locationEnabled and hasPush', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: true,
    };
    expect(buildHostAppPodSnippet(IOS_PATH, false, options)).toBe(
      "pod 'customerio-reactnative', :subspecs => ['apn', 'location'], :path => '../node_modules/customerio-reactnative'"
    );
  });

  it('returns only location subspec when locationEnabled and no push', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: false,
    };
    expect(buildHostAppPodSnippet(IOS_PATH, true, options)).toBe(
      "pod 'customerio-reactnative', :subspecs => ['location'], :path => '../node_modules/customerio-reactnative'"
    );
    expect(buildHostAppPodSnippet(IOS_PATH, false, options)).toBe(
      "pod 'customerio-reactnative', :subspecs => ['location'], :path => '../node_modules/customerio-reactnative'"
    );
  });
});
