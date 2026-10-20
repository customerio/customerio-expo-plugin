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
    expect(workflow).toContain('xcodebuild_status="$?"');
    expect(workflow).toContain('if [[ "$xcodebuild_status" -ne 0 ]]');
    expect(workflow).toContain(
      'xcodebuild -showBuildSettings failed with exit code $xcodebuild_status'
    );
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
    expect(step('Install and launch generated app').uses).toBe(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@main'
    );
    expect(step('Install and launch generated app').id).toBe('launch');
    // Only the legacy host may fail its launch; a UIScene host failing to
    // launch fails the job.
    expect(step('Install and launch generated app')['continue-on-error']).toBe(
      "${{ matrix.expectation == 'uiscene-failure' }}"
    );
    expect(step('Upload compatibility logs').if).toBe('always()');
    expect(step('Upload compatibility logs').with['if-no-files-found']).toBe(
      'error'
    );
    expect(workflow).not.toContain('steps.launch.outputs.failure-reason');
    expect(workflow).not.toContain('Record compatibility result');
    expect(workflow).not.toContain('Record launch failure');
    expect(workflow).not.toContain('Record unclassified failure');
  });

  it('expects UIScene hosts to launch and keeps one legacy-host leg', () => {
    const legs = definition.jobs.preview.strategy.matrix.include;
    const launching = legs.filter((leg) => leg.expectation === 'launch');
    const legacy = legs.filter((leg) => leg.expectation === 'uiscene-failure');

    // `latest` is the SDK 58+ scene host, built with both push providers.
    expect(launching).toEqual([
      { 'expo-version': 'latest', 'ios-push-provider': 'apn', expectation: 'launch' },
      { 'expo-version': 'latest', 'ios-push-provider': 'fcm', expectation: 'launch' },
    ]);
    // SDK 57 is the newest supported host without UIScene.
    expect(legacy).toEqual([
      { 'expo-version': 57, 'ios-push-provider': 'apn', expectation: 'uiscene-failure' },
    ]);
    expect(legs).toHaveLength(launching.length + legacy.length);

    // Every leg generates, validates and uploads its own Expo version.
    expect(step('Create Test App').run).toContain(
      '--expo-version=${{ matrix.expo-version }}'
    );
    expect(step('Validate Plugin').run).toContain(
      '--expo-version=${{ matrix.expo-version }}'
    );
    expect(step('Upload compatibility logs').with.name).toBe(
      'xcode-27-preview-expo-${{ matrix.expo-version }}-${{ matrix.ios-push-provider }}-logs'
    );
  });

  it('inverts the known Expo failure into a green assertion', () => {
    const assertion = step('Assert the known Expo UIScene launch failure');
    expect(assertion).toBeDefined();
    expect(assertion.id).toBe('known-failure');
    // Only the legacy host is expected to fail.
    expect(assertion.if).toBe("matrix.expectation == 'uiscene-failure'");

    // Gate on the step outcome, never on the composite action's
    // `failure-reason` output, which a failing composite step does not
    // reliably propagate.
    expect(assertion.env.LAUNCH_OUTCOME).toBe('${{ steps.launch.outcome }}');

    // All three assertions must be present: the launch still fails, it fails
    // with the known signature, and the premise (Expo SDK 57) still holds.
    expect(assertion.env.EXPECTED_EXPO_MAJOR).toBe('57');
    expect(assertion.env.KNOWN_SIGNATURE).toBe(
      'UIScene life cycle is required|_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption'
    );
    expect(assertion.run).toContain('launch-now-succeeds');
    expect(assertion.run).toContain('signature-changed');
    expect(assertion.run).toContain('expo-sdk-moved');

    // The assertion has to run before the artifact upload so a flip cannot be
    // hidden behind an upload failure.
    const names = steps.map((candidate) => candidate.name);
    expect(names.indexOf('Assert the known Expo UIScene launch failure')).
      toBeLessThan(names.indexOf('Upload compatibility logs'));
  });

  it('notifies only the nightly, on the same pinned Slack action as deploy-sdk', () => {
    const notify = step('Notify team when the Xcode 27 nightly changes state');
    expect(notify).toBeDefined();
    // Each leg gates on the outcome of the step that decides it -- the launch
    // for UIScene hosts, the assertion for the legacy host -- rather than
    // failure(): a passing launch or gate followed by a failed upload must not
    // alert, and a cancelled run (concurrency cancels in-progress nightlies)
    // must not either -- both would report a change that did not happen.
    expect(notify.if).toBe(
      "always() && github.event_name == 'schedule' && " +
        "((matrix.expectation == 'launch' && " +
        "(steps.launch.outcome == 'failure' || " +
        "(!cancelled() && steps.launch.outcome == 'skipped'))) || " +
        "(matrix.expectation == 'uiscene-failure' && " +
        "(steps.known-failure.outcome == 'failure' || " +
        "(!cancelled() && steps.known-failure.outcome == 'skipped'))))"
    );
    expect(notify.if).not.toContain('failure()');
    // A real flip must still alert if the run is cancelled afterwards, so
    // !cancelled() guards only the ambiguous `skipped` branch.
    expect(notify.if).not.toMatch(/^!cancelled\(\)/);
    expect(notify.if).toContain("(!cancelled() && steps.known-failure.outcome == 'skipped')");
    expect(notify.env.SLACK_WEBHOOK_TYPE).toBe('INCOMING_WEBHOOK');
    expect(notify.env.SLACK_WEBHOOK_URL).toBe(
      '${{ secrets.SLACK_WEBHOOK_URL }}'
    );

    // Same pinned SHA the deploy workflow already uses — no second pin to keep
    // in step with dependabot.
    const deploy = fs.readFileSync(
      path.join(__dirname, '../../.github/workflows/deploy-sdk.yml'),
      'utf8'
    );
    const pinned = deploy.match(/slackapi\/slack-github-action@[0-9a-f]{40}/);
    expect(pinned).not.toBeNull();
    expect(notify.uses.split(' ')[0]).toBe(pinned[0]);

    // The message has to name which flip happened; "it broke" is what made the
    // permanently-red job useless.
    const payload = notify.with.payload;
    expect(payload).toContain('launch-leg-failed');
    expect(payload).toContain('launch-now-succeeds');
    expect(payload).toContain('signature-changed');
    expect(payload).toContain('expo-version-unresolved');
    expect(payload).toContain('steps.known-failure.outputs.flip-reason');

    // `permissions: contents: read` is enough for a webhook post; assert it was
    // not quietly widened to add the notification.
    expect(definition.permissions).toEqual({ contents: 'read' });
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
  }, 60_000);
});
