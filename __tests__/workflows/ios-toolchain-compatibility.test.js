const fs = require('fs');
const path = require('path');
const { parse } = require('yaml');

const workflowPath = path.join(
  __dirname,
  '../../.github/workflows/ios-toolchain-compatibility.yml'
);

describe('Xcode 27 preview workflow', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const definition = parse(workflow);
  const steps = definition.jobs.preview.steps;
  const step = (name) => steps.find((candidate) => candidate.name === name);

  it('uses the repository Node version and launches the generated app', () => {
    expect(definition.env.NODE_VERSION).toBe('24');
    expect(workflow).toContain('-showBuildSettings');
    expect(workflow).toContain('WRAPPER_EXTENSION');
    expect(workflow).toContain('APP_PRODUCT_PATH=');
    expect(workflow).toContain('build-settings-private.json');
    expect(workflow).toContain('trap \'rm -f "$private_settings_json"\' EXIT');
    expect(workflow).toContain('"TARGET_BUILD_DIR",');
    expect(workflow).toContain('"WRAPPER_NAME",');
    expect(step('Upload compatibility logs').with.path).not.toContain(
      'build-settings-private.json'
    );
    expect(workflow).toContain(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@'
    );
    expect(workflow).toContain('workspaces=("$APP_PATH"/ios/*.xcworkspace)');
    expect(workflow).not.toContain('$APP_NAME.xcworkspace');
    expect(workflow).toContain('stale_executables.append(executable)');
    expect(workflow).toContain("expected-ios-major: '27'");
    expect(workflow).toContain('steps.launch.outputs.failure-reason');
    expect(workflow).toContain('simulator-infrastructure-unavailable');
    expect(workflow).toContain('**Classification:** launch-passed');
    expect(step('Record compatibility result').if).toBe(
      "steps.launch.outcome == 'success'"
    );
    expect(workflow).not.toContain('**Result:** ${{ job.status }}');
    expect(workflow).toContain(
      'launch-simulator-app/v1@7e22693841ec0e896dbef13efac814e54ba09c41'
    );
    expect(step('Record unavailable toolchain').if).toContain(
      "steps.toolchain.outcome == 'failure'"
    );
    expect(workflow).toContain('settings.get("CONFIGURATION") != "Release"');
    expect(workflow).toContain('could not parse xcodebuild settings JSON');
  });
});
