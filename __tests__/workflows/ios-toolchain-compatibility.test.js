const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('yaml');

const workflowPath = path.join(
  __dirname,
  '../../.github/workflows/ios-toolchain-compatibility.yml'
);

describe('Xcode 27 preview workflow', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const resolver = fs.readFileSync(
    path.join(
      __dirname,
      '../../scripts/compatibility/resolve_simulator_app.py'
    ),
    'utf8'
  );
  const definition = parse(workflow);
  const steps = definition.jobs.preview.steps;
  const step = (name) => steps.find((candidate) => candidate.name === name);

  it('uses the repository Node version and launches the generated app', () => {
    expect(definition.env.NODE_VERSION).toBe('24');
    expect(workflow).toContain('-showBuildSettings');
    expect(resolver).toContain('"WRAPPER_EXTENSION"');
    expect(workflow).toContain('APP_PRODUCT_PATH=');
    expect(workflow).toContain('build-settings-private.json');
    expect(workflow).toContain('trap \'rm -f "$private_settings_json"\' EXIT');
    expect(workflow).toContain(
      'scripts/compatibility/resolve_simulator_app.py'
    );
    expect(workflow).toContain('--sanitized-settings-json "$settings_json"');
    expect(workflow).toContain('--clean');
    expect(
      step('Upload compatibility logs').with.path.trim().split('\n')
    ).toEqual([
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-launch.log',
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-build-settings.json',
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-build-start-epoch',
    ]);
    expect(workflow).toContain(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@'
    );
    expect(workflow).toContain('workspaces=("$APP_PATH"/ios/*.xcworkspace)');
    expect(workflow).not.toContain('$APP_NAME.xcworkspace');
    expect(workflow).toContain("expected-ios-major: '27'");
    expect(workflow).toContain('steps.launch.outputs.failure-reason');
    expect(workflow).toContain('simulator-infrastructure-unavailable');
    expect(workflow).toContain('**Classification:** launch-passed');
    expect(step('Record compatibility result').if).toBe(
      "steps.launch.outcome == 'success'"
    );
    expect(workflow).not.toContain('**Result:** ${{ job.status }}');
    expect(workflow).toContain(
      'launch-simulator-app/v1@7dae70961c011b4ab475ec0b01860f2597b7cba2'
    );
    expect(step('Record unavailable toolchain').if).toContain(
      "steps.toolchain.outcome == 'failure'"
    );
    expect(step('Record launch failure').if).toBe(
      "failure() && steps.launch.outcome == 'failure'"
    );
    expect(step('Record generated-app build failure').if).toContain(
      "steps.validate-plugin.outcome == 'failure'"
    );
    expect(step('Record product resolution failure').if).toContain(
      "steps.resolve-app.outcome == 'failure'"
    );
    expect(workflow).toContain('unrecognized launch failure reason');
    expect(step('Record unclassified failure').if).toBe(
      "failure() && steps.toolchain.outcome != 'failure' && steps.validate-plugin.outcome != 'failure' && steps.resolve-app.outcome != 'failure' && steps.launch.outcome != 'failure' && steps.launch.outcome != 'success'"
    );
  });

  it('executes the generated-app resolver behavior suite', () => {
    try {
      execFileSync(
        'python3',
        [
          '-m',
          'unittest',
          'scripts/compatibility/test_resolve_simulator_app.py',
        ],
        { cwd: path.join(__dirname, '../..'), stdio: 'pipe' }
      );
    } catch (error) {
      throw new Error(
        `resolver behavior suite failed: ${error.message}\nstdout:\n${
          error.stdout ?? ''
        }\nstderr:\n${error.stderr ?? ''}`
      );
    }
  });
});
