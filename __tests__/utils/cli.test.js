const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  execSync: (...args) => mockExecSync(...args),
}));

const { runScriptWithArgs } = require('../../scripts/utils/cli');

describe('runScriptWithArgs', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    mockExecSync.mockClear();
  });

  test('forwards parent CLI arguments with priority over caller arguments', () => {
    process.argv = [
      'node',
      'scripts/compatibility/validate-plugin.js',
      '--app-path=/tmp/cli-customerio-expo-compatibility-test',
      '--ios-use-frameworks=static',
    ];

    runScriptWithArgs('compatibility:configure-plugin', {
      args: {
        'app-path': '/tmp/customerio-expo-compatibility-test',
        'ios-push-provider': 'apn',
      },
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      'npm run compatibility:configure-plugin -- ' +
        '--app-path=/tmp/cli-customerio-expo-compatibility-test ' +
        '--ios-push-provider=apn --ios-use-frameworks=static',
      { stdio: 'inherit' }
    );
  });
});
