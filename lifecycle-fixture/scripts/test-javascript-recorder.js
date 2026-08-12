const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SOURCE_PATH = path.join(
  REPO_ROOT,
  'lifecycle-fixture/javascript/LifecycleReceipts.ts'
);

function loadRecorder() {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: SOURCE_PATH,
  }).outputText;
  const loaded = new Module(SOURCE_PATH, module);
  loaded.filename = SOURCE_PATH;
  loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (request) => {
    if (request === 'expo-linking' || request === 'expo-notifications') {
      return {};
    }
    if (request === 'expo-modules-core') {
      return { requireNativeModule: () => null };
    }
    if (request === 'react-native') {
      return { AppState: { currentState: 'active' } };
    }
    return originalRequire(request);
  };
  loaded._compile(javascript, SOURCE_PATH);
  return loaded.exports.LifecycleJavascriptRecorder;
}

function framework(name, role, version, commitSha = null) {
  return { name, role, version, commit_sha: commitSha };
}

async function main() {
  const Recorder = loadRecorder();
  const context = {
    manifestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    runId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    javascriptStreamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    processInstanceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    scenario: 'app-background-foreground',
    evidenceLevel: 'diagnostic',
    integration: 'expo',
    runtime: 'javascript',
    provider: 'none',
  };
  const output = [];
  const originalLog = console.log;
  console.log = (line) => output.push(String(line));
  try {
    const recorder = new Recorder(context, 2);
    recorder.start();
    for (let index = 0; index < 3; index += 1) {
      recorder.record(
        'wrapper.app-lifecycle-state',
        'expo-javascript',
        'app-received',
        'state-change',
        { enums: { app_state: index % 2 === 0 ? 'active' : 'background' } }
      );
    }
    await recorder.end();
  } finally {
    console.log = originalLog;
  }

  const tracePrefix = 'CIO-LIFECYCLE-TRACE ';
  const receiptPrefix = 'CIO-LIFECYCLE-RECEIPT ';
  const traceLines = output.filter((line) => line.startsWith(tracePrefix));
  const receiptLine = output.find((line) => line.startsWith(receiptPrefix));
  if (!receiptLine) throw new Error('JavaScript recorder emitted no receipt');
  const records = traceLines.map((line) =>
    JSON.parse(line.slice(tracePrefix.length))
  );
  const receipt = JSON.parse(receiptLine.slice(receiptPrefix.length));
  if (records[0].callback !== 'trace.scenario-start') {
    throw new Error('scenario-start was not preserved during overflow');
  }
  if (records.at(-1).callback !== 'trace.scenario-end') {
    throw new Error('scenario-end is not the final record');
  }
  if (receipt.dropped_records_total <= 0) {
    throw new Error('overflow exercise did not drop records');
  }
  if (
    receipt.emitted_records + receipt.dropped_records_total !==
    receipt.last_assigned_sequence
  ) {
    throw new Error('receipt accounting does not reconcile');
  }

  const now = Date.now();
  const timestamp = (delta) => new Date(now + delta).toISOString();
  const iosCommit = '1111111111111111111111111111111111111111';
  const expoCommit = '3637028bfa4c5c66752697b346ad826266e6ae03';
  const reactNativeCommit = '1edc94769359dfd992d6622884561d448d3f8dd9';
  const manifest = {
    schema: 'cio-lifecycle-capture-manifest/1',
    manifest_id: context.manifestId,
    run_id: context.runId,
    run_started_at: timestamp(-60_000),
    run_ended_at: timestamp(60_000),
    created_at: timestamp(120_000),
    evidence_level: 'diagnostic',
    scenario: 'app-background-foreground',
    repositories: [
      {
        name: 'customerio-ios',
        commit_sha: iosCommit,
        dirty: false,
        source_snapshot: null,
      },
      {
        name: 'customerio-expo-plugin',
        commit_sha: expoCommit,
        dirty: false,
        source_snapshot: null,
      },
      {
        name: 'customerio-reactnative',
        commit_sha: reactNativeCommit,
        dirty: false,
        source_snapshot: null,
      },
    ],
    toolchain: {
      xcode_version: '26.6',
      xcode_build: '17F113',
      swift_version: null,
      flutter_version: null,
      dart_version: null,
      node_version: process.version.slice(1),
      expo_cli_version: '57.0.12',
    },
    sdk: {
      platform: 'ios',
      name: 'iphonesimulator',
      version: '26.5',
      build: '23F77',
    },
    build: {
      configuration: 'Debug',
      scheme: 'LifecycleFixtureExpo57',
      target_name: 'LifecycleFixtureExpo57Tests',
      product_kind: 'unit-test',
      deployment_target: '16.4',
    },
    target: {
      kind: 'simulator',
      model: 'iPhone 17 Pro',
      architecture: 'arm64',
      os_name: 'iOS',
      os_version: '26.5',
      os_build: '23F77',
    },
    frameworks: [
      framework('customerio-ios', 'sdk', '3.13.1', iosCommit),
      framework('customerio-expo-plugin', 'wrapper', '3.7.1', expoCommit),
      framework('expo', 'runtime', '57.0.12'),
      framework('expo-notifications', 'peer', '57.0.10'),
      framework('expo-modules-core', 'peer', '57.0.10'),
      framework(
        'customerio-reactnative',
        'wrapper',
        '6.6.2',
        reactNativeCommit
      ),
      framework('react-native', 'runtime', '0.86.2'),
      framework('apple-usernotifications', 'platform-framework', '26.5'),
    ],
    provider_provenance: {
      provider: 'none',
      source: 'none',
      environment: 'none',
      receipt_result: 'not-applicable',
      receipt_recorded_at: null,
      provider_sdk: null,
    },
    stimulus: {
      scenario: 'app-background-foreground',
      source: 'simulator-control',
      initiated_at: timestamp(-30_000),
    },
    streams: [
      {
        stream_id: context.javascriptStreamId,
        integration: 'expo',
        runtime: 'javascript',
        provider: 'none',
        process_id: null,
        process_instance_id: context.processInstanceId,
        receipt,
      },
    ],
    aggregate_assertions: [],
  };

  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cio-expo-js-recorder-')
  );
  const manifestPath = path.join(temporary, 'manifest.json');
  const tracePath = path.join(temporary, 'javascript.ndjson');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(tracePath, `${traceLines.join('\n')}\n`);
  const python = process.env.CIO_LIFECYCLE_PYTHON || 'python3';
  const validation = spawnSync(
    python,
    [
      path.join(REPO_ROOT, 'docs/dev-notes/validate_ios27_lifecycle_trace.py'),
      manifestPath,
      tracePath,
    ],
    { encoding: 'utf8' }
  );
  if (validation.status !== 0) {
    process.stderr.write(validation.stdout);
    process.stderr.write(validation.stderr);
    process.exit(validation.status || 1);
  }
  process.stdout.write(validation.stdout);
  process.stdout.write(
    `JavaScript overflow capture validated: ${records.length} emitted, ${receipt.dropped_records_total} dropped\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
