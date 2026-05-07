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

// The snippet bakes the prebuild-resolved relative path directly into
// :path => '...'. The choice of lexical vs realpath happens earlier, in
// `getRelativePathToRNSDK`, which dispatches on the installed React Native
// version. These tests cover the snippet shape and the subspec matrix.

const RESOLVED_PATH = '../node_modules/customerio-reactnative';

function expectsPodLine(snippet: string, line: string) {
  expect(snippet).toBe(line);
}

describe('buildHostAppPodSnippet', () => {
  it('emits the apn subspec line with a baked :path', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, false, {
      locationEnabled: false,
    });
    expectsPodLine(
      snippet,
      `pod 'customerio-reactnative/apn', :path => '${RESOLVED_PATH}'`
    );
  });

  it('emits the fcm subspec line with a baked :path', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, true, {
      locationEnabled: false,
    });
    expectsPodLine(
      snippet,
      `pod 'customerio-reactnative/fcm', :path => '${RESOLVED_PATH}'`
    );
  });

  it('defaults to single subspec when options are omitted', () => {
    const apnSnippet = buildHostAppPodSnippet(IOS_PATH, false);
    expectsPodLine(
      apnSnippet,
      `pod 'customerio-reactnative/apn', :path => '${RESOLVED_PATH}'`
    );

    const fcmSnippet = buildHostAppPodSnippet(IOS_PATH, true);
    expectsPodLine(
      fcmSnippet,
      `pod 'customerio-reactnative/fcm', :path => '${RESOLVED_PATH}'`
    );
  });

  it('uses :subspecs => with push + location when both enabled', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: true,
    };
    const fcmSnippet = buildHostAppPodSnippet(IOS_PATH, true, options);
    expectsPodLine(
      fcmSnippet,
      `pod 'customerio-reactnative', :subspecs => ['fcm', 'location'], :path => '${RESOLVED_PATH}'`
    );

    const apnSnippet = buildHostAppPodSnippet(IOS_PATH, false, options);
    expectsPodLine(
      apnSnippet,
      `pod 'customerio-reactnative', :subspecs => ['apn', 'location'], :path => '${RESOLVED_PATH}'`
    );
  });

  it('emits only the location subspec line when locationEnabled and !hasPush', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: false,
    };
    const snippet = buildHostAppPodSnippet(IOS_PATH, true, options);
    expectsPodLine(
      snippet,
      `pod 'customerio-reactnative', :subspecs => ['location'], :path => '${RESOLVED_PATH}'`
    );
  });

  it('does not emit any Ruby lambda or install-time resolver block', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, false);
    // Lambda was the previous shape; we resolve at prebuild now and bake.
    expect(snippet).not.toContain('lambda do');
    expect(snippet).not.toContain('require.resolve');
  });
});
