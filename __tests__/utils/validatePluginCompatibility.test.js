const mockRunCommand = jest.fn();
const mockRunScriptWithArgs = jest.fn();

jest.mock('../../scripts/utils/cli', () => {
  const actual = jest.requireActual('../../scripts/utils/cli');
  return {
    ...actual,
    runCommand: (...args) => mockRunCommand(...args),
    runScript: (execute) => execute(),
    runScriptWithArgs: (...args) => mockRunScriptWithArgs(...args),
  };
});

describe('compatibility:validate-plugin iOS configuration', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    jest.clearAllMocks();
  });

  function loadValidator(iosUseFrameworks) {
    process.argv = [
      'node',
      'scripts/compatibility/validate-plugin.js',
      '--app-path=/tmp/customerio-expo-compatibility-test',
      '--platforms=ios',
      '--ios-push-providers=apn,fcm',
    ];
    if (iosUseFrameworks !== undefined) {
      process.argv.push(`--ios-use-frameworks=${iosUseFrameworks}`);
    }

    jest.isolateModules(() => {
      require('../../scripts/compatibility/validate-plugin');
    });

    return mockRunScriptWithArgs.mock.calls.filter(
      ([script]) => script === 'compatibility:configure-plugin'
    );
  }

  test('forwards static frameworks to every provider configuration', () => {
    expect(loadValidator('static')).toEqual([
      [
        'compatibility:configure-plugin',
        {
          args: {
            'app-path': '/tmp/customerio-expo-compatibility-test',
            'ios-push-provider': 'apn',
            'ios-use-frameworks': 'static',
          },
        },
      ],
      [
        'compatibility:configure-plugin',
        {
          args: {
            'app-path': '/tmp/customerio-expo-compatibility-test',
            'ios-push-provider': 'fcm',
            'ios-use-frameworks': 'static',
          },
        },
      ],
    ]);
  });

  test('leaves frameworks absent when the validator option is omitted', () => {
    expect(loadValidator()).toEqual([
      [
        'compatibility:configure-plugin',
        {
          args: {
            'app-path': '/tmp/customerio-expo-compatibility-test',
            'ios-push-provider': 'apn',
          },
        },
      ],
      [
        'compatibility:configure-plugin',
        {
          args: {
            'app-path': '/tmp/customerio-expo-compatibility-test',
            'ios-push-provider': 'fcm',
          },
        },
      ],
    ]);
  });
});
