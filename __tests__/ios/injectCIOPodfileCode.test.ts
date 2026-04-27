import {
  buildHostAppPodSnippet,
  buildResolveSnippet,
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

// The snippet must (a) emit a `customerio_reactnative_path` lambda that calls
// Node's require.resolve at pod install time, and (b) reference that variable
// on every `pod 'customerio-reactnative...'` line. The prebuild-time path
// from `getRelativePathToRNSDK` is baked into the lambda only as the
// fallback. This is the structure that keeps our path in agreement with
// React Native autolinking under pnpm/yarn symlinks.

const FALLBACK_PATH = '../node_modules/customerio-reactnative';

function expectsLambda(snippet: string) {
  expect(snippet).toContain('customerio_reactnative_path = (lambda do');
  expect(snippet).toContain(
    `\`node --print "require.resolve('customerio-reactnative/package.json')" 2>/dev/null\`.strip`
  );
  expect(snippet).toContain(
    'Pathname.new(File.dirname(out)).relative_path_from(Pathname.new(__dir__)).to_s'
  );
  expect(snippet).toContain(`'${FALLBACK_PATH}'`);
  expect(snippet).toContain('end).call');
}

function expectsPodLine(snippet: string, line: string) {
  expect(snippet).toContain(line);
  // The pod line must reference the variable, not a baked path.
  expect(snippet).not.toMatch(/pod 'customerio-reactnative.*:path => '[^']*'/);
}

describe('buildHostAppPodSnippet', () => {
  it('emits the lambda + apn subspec line referencing the variable', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, false, {
      locationEnabled: false,
    });
    expectsLambda(snippet);
    expectsPodLine(
      snippet,
      "pod 'customerio-reactnative/apn', :path => customerio_reactnative_path"
    );
  });

  it('emits the lambda + fcm subspec line referencing the variable', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, true, {
      locationEnabled: false,
    });
    expectsLambda(snippet);
    expectsPodLine(
      snippet,
      "pod 'customerio-reactnative/fcm', :path => customerio_reactnative_path"
    );
  });

  it('defaults to single subspec when options are omitted', () => {
    const apnSnippet = buildHostAppPodSnippet(IOS_PATH, false);
    expectsLambda(apnSnippet);
    expectsPodLine(
      apnSnippet,
      "pod 'customerio-reactnative/apn', :path => customerio_reactnative_path"
    );

    const fcmSnippet = buildHostAppPodSnippet(IOS_PATH, true);
    expectsLambda(fcmSnippet);
    expectsPodLine(
      fcmSnippet,
      "pod 'customerio-reactnative/fcm', :path => customerio_reactnative_path"
    );
  });

  it('uses :subspecs => with push + location when both enabled', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: true,
    };
    const fcmSnippet = buildHostAppPodSnippet(IOS_PATH, true, options);
    expectsLambda(fcmSnippet);
    expectsPodLine(
      fcmSnippet,
      "pod 'customerio-reactnative', :subspecs => ['fcm', 'location'], :path => customerio_reactnative_path"
    );

    const apnSnippet = buildHostAppPodSnippet(IOS_PATH, false, options);
    expectsLambda(apnSnippet);
    expectsPodLine(
      apnSnippet,
      "pod 'customerio-reactnative', :subspecs => ['apn', 'location'], :path => customerio_reactnative_path"
    );
  });

  it('emits only the location subspec line when locationEnabled and !hasPush', () => {
    const options: InjectCIOPodfileOptions = {
      locationEnabled: true,
      hasPush: false,
    };
    const snippet = buildHostAppPodSnippet(IOS_PATH, true, options);
    expectsLambda(snippet);
    expectsPodLine(
      snippet,
      "pod 'customerio-reactnative', :subspecs => ['location'], :path => customerio_reactnative_path"
    );
  });

  it('emits exactly one lambda definition per snippet (idempotence)', () => {
    const snippet = buildHostAppPodSnippet(IOS_PATH, false, {
      locationEnabled: true,
      hasPush: true,
    });
    const matches = snippet.match(/customerio_reactnative_path = \(lambda do/g);
    expect(matches).toHaveLength(1);
  });
});

describe('buildResolveSnippet', () => {
  it('embeds the supplied fallback string verbatim inside the lambda', () => {
    const snippet = buildResolveSnippet('../my/custom/fallback');
    expect(snippet).toContain(`'../my/custom/fallback'`);
  });

  it('does not bake the fallback as the :path => value (it goes in the lambda only)', () => {
    const snippet = buildResolveSnippet(FALLBACK_PATH);
    // Should not be of the form `:path => '<fallback>'` — that would be
    // the old behavior we are deliberately moving away from.
    expect(snippet).not.toMatch(/:path => '[^']*'/);
  });
});
