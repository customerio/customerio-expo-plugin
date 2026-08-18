import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { requireNativeModule } from 'expo-modules-core';
import { AppState, AppStateStatus } from 'react-native';

type EvidenceLevel = 'diagnostic' | 'L2' | 'L3';
type Provider = 'apn' | 'fcm' | 'local' | 'none' | 'unknown';

export type HarnessContext = {
  manifestId: string;
  runId: string;
  javascriptStreamId: string;
  processInstanceId: string;
  hostTopology: 'app-delegate-only' | 'ui-scene';
  activationOccurrenceId: string;
  scenario: string;
  evidenceLevel: EvidenceLevel;
  integration: 'expo';
  runtime: 'javascript';
  provider: Provider;
};

type ProbeModule = {
  getHarnessContext(): HarnessContext | null;
  getNativeReceipt(): Record<string, unknown> | null;
  writeJavascriptTrace(line: string): boolean;
  writeJavascriptReceipt(json: string): boolean;
};

type Summary = {
  flags?: Record<string, boolean>;
  counts?: Record<string, number>;
  enums?: Record<string, string>;
  rawCorrelation?: Partial<Record<CorrelationNamespace, string>>;
};

type CorrelationNamespace =
  | 'occurrence'
  | 'delivery'
  | 'request'
  | 'scene'
  | 'url'
  | 'closure';

const TRACE_PREFIX = 'CIO-LIFECYCLE-TRACE ';
const RECEIPT_PREFIX = 'CIO-LIFECYCLE-RECEIPT ';
const BUFFER_CAPACITY = 512;
const ALIAS_CAPACITY = 256;
const namespaces: CorrelationNamespace[] = [
  'occurrence',
  'delivery',
  'request',
  'scene',
  'url',
  'closure',
];

export class LifecycleJavascriptRecorder {
  private sequence = 0;
  private emittedRecords = 0;
  private droppedRecordsTotal = 0;
  private bufferHighWatermark = 0;
  private readonly startedAt = performance.now();
  private readonly aliases = new Map<CorrelationNamespace, Map<string, number>>(
    namespaces.map((namespace) => [namespace, new Map()])
  );
  private readonly overflow = new Set<CorrelationNamespace>();
  private queue: Array<Record<string, unknown>> = [];
  private drainScheduled = false;
  private ended = false;
  private sinkFailed = false;
  private drainWaiters: Array<() => void> = [];

  constructor(
    private readonly context: HarnessContext,
    private readonly bufferCapacity = BUFFER_CAPACITY,
    private readonly nativeSink: ProbeModule | null = null
  ) {
    if (bufferCapacity < 2) {
      throw new Error('trace buffer must preserve start and end controls');
    }
  }

  start(): void {
    this.record(
      'trace.scenario-start',
      'trace-recorder',
      'trace-control',
      'state-change'
    );
  }

  record(
    callback: string,
    owner: string,
    kind: string,
    phase: string,
    summary: Summary = {}
  ): void {
    if (this.ended) return;

    this.sequence += 1;
    const correlation: Record<string, string> = {};
    const rawCorrelation: Summary['rawCorrelation'] =
      kind === 'trace-control'
        ? summary.rawCorrelation
        : {
            occurrence: this.context.activationOccurrenceId,
            ...summary.rawCorrelation,
          };
    for (const [namespace, raw] of Object.entries(
      rawCorrelation ?? {}
    ) as Array<[CorrelationNamespace, string]>) {
      const table = this.aliases.get(namespace)!;
      let ordinal = table.get(raw);
      if (ordinal == null) {
        if (table.size >= ALIAS_CAPACITY) {
          this.overflow.add(namespace);
          continue;
        }
        ordinal = table.size + 1;
        table.set(raw, ordinal);
      }
      correlation[namespace] = `${namespace}-${ordinal}`;
    }

    if (this.queue.length >= this.bufferCapacity) {
      const dropIndex = this.queue.findIndex(
        (queued) =>
          queued.callback !== 'trace.scenario-start' &&
          queued.callback !== 'trace.scenario-end'
      );
      if (dropIndex < 0) return;
      const dropped = this.queue.splice(dropIndex, 1)[0];
      this.droppedRecordsTotal += 1;
      const droppedSequence = dropped.sequence as number;
      for (const queued of this.queue) {
        if ((queued.sequence as number) <= droppedSequence) continue;
        const snapshot = queued.recorder as Record<string, unknown>;
        snapshot.dropped_records_total = this.droppedRecordsTotal;
        snapshot.buffer_high_watermark = this.bufferCapacity;
      }
    }

    const aliasCounts = Object.fromEntries(
      namespaces.map((namespace) => [
        namespace,
        this.aliases.get(namespace)!.size,
      ])
    );
    const record = {
      schema: 'cio-lifecycle-trace/1',
      manifest_id: this.context.manifestId,
      run_id: this.context.runId,
      stream_id: this.context.javascriptStreamId,
      sequence: this.sequence,
      monotonic_ms: Math.max(0, Math.floor(performance.now() - this.startedAt)),
      captured_at: new Date().toISOString(),
      process_id: null,
      integration: this.context.integration,
      runtime: this.context.runtime,
      provider: this.context.provider,
      scenario: this.context.scenario,
      evidence_level: this.context.evidenceLevel,
      owner,
      kind,
      callback,
      phase,
      // React Native JavaScript callbacks execute on the JS runtime queue, not
      // on UIKit's main thread.
      main_thread: false,
      payload_summary: {
        flags: summary.flags ?? {},
        counts: summary.counts ?? {},
        enums: summary.enums ?? {},
      },
      correlation: Object.keys(correlation).length === 0 ? null : correlation,
      completion: null,
      recorder: {
        dropped_records_total: this.droppedRecordsTotal,
        alias_counts: aliasCounts,
        alias_overflow: this.overflow.size > 0,
        alias_overflow_namespaces: [...this.overflow].sort(),
        buffer_high_watermark: Math.max(
          this.bufferHighWatermark,
          Math.min(this.bufferCapacity, this.queue.length + 1)
        ),
        buffer_capacity: this.bufferCapacity,
      },
    };

    this.queue.push(record);
    this.bufferHighWatermark = Math.max(
      this.bufferHighWatermark,
      this.queue.length
    );
    this.scheduleDrain();
  }

  async end(): Promise<void> {
    if (this.ended) return;
    this.record(
      'trace.scenario-end',
      'trace-recorder',
      'trace-control',
      'state-change'
    );
    this.ended = true;
    await this.waitForDrain();
    const aliasCounts = Object.fromEntries(
      namespaces.map((namespace) => [
        namespace,
        this.aliases.get(namespace)!.size,
      ])
    );
    const receipt = JSON.stringify({
      last_assigned_sequence: this.sequence,
      last_emitted_sequence: this.sequence,
      emitted_records: this.emittedRecords,
      dropped_records_total: this.droppedRecordsTotal,
      buffer_high_watermark: this.bufferHighWatermark,
      buffer_capacity: this.bufferCapacity,
      alias_counts: aliasCounts,
      alias_overflow: this.overflow.size > 0,
      alias_overflow_namespaces: [...this.overflow].sort(),
      drained_at: new Date().toISOString(),
    });
    if (!this.sinkFailed && this.nativeSink) {
      this.sinkFailed = !this.nativeSink.writeJavascriptReceipt(receipt);
    }
    console.log(RECEIPT_PREFIX + receipt);
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    queueMicrotask(() => this.drain());
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const record = this.queue.shift()!;
      const line = TRACE_PREFIX + JSON.stringify(record);
      if (this.nativeSink && !this.nativeSink.writeJavascriptTrace(line)) {
        this.sinkFailed = true;
      } else {
        this.emittedRecords += 1;
      }
      console.log(line);
    }
    this.drainScheduled = false;
    for (const resolve of this.drainWaiters.splice(0)) resolve();
  }

  private waitForDrain(): Promise<void> {
    if (!this.drainScheduled && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.drainWaiters.push(resolve));
  }
}

function notificationSummary(
  notification: Notifications.Notification,
  actionIdentifier?: string
): Summary {
  const request = notification.request;
  const data = request.content.data ?? {};
  const trigger = request.trigger as {
    type?: string;
    payload?: Record<string, unknown>;
  } | null;
  const isRemote = trigger?.type === 'push';
  const hasResponse = actionIdentifier != null;
  const userInfo = isRemote && trigger?.payload ? trigger.payload : data;
  const hasDeliveryId = typeof userInfo['CIO-Delivery-ID'] === 'string';
  const hasDeliveryToken = typeof userInfo['CIO-Delivery-Token'] === 'string';
  const rawCorrelation: Summary['rawCorrelation'] = {
    request: request.identifier,
  };
  if (hasDeliveryId) {
    rawCorrelation.delivery = userInfo['CIO-Delivery-ID'] as string;
  }
  return {
    flags: {
      has_notification: true,
      has_notification_response: hasResponse,
      has_aps: 'aps' in userInfo,
      has_delivery_id: hasDeliveryId,
      has_delivery_token: hasDeliveryToken,
    },
    counts: { notification_user_info_keys: Object.keys(userInfo).length },
    enums: {
      notification_origin: isRemote ? 'remote' : 'local',
      notification_class:
        hasDeliveryId && hasDeliveryToken ? 'customerio' : 'non-customerio',
      delegate_peer: 'expo-notifications',
      ...(hasResponse
        ? {
            action_class:
              actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
                ? 'default'
                : 'custom',
          }
        : {}),
    },
    rawCorrelation,
  };
}

function urlSummary(url: string): Summary {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // The URL remains an in-memory alias input only. No raw text is emitted.
  }
  const scheme = parsed?.protocol.replace(':', '').toLowerCase();
  const isWeb = scheme === 'https' || scheme === 'http';
  const deliveryId = parsed?.searchParams.get('cio_delivery_id');
  const hasDeliveryToken =
    parsed?.searchParams.has('cio_delivery_token') ?? false;
  const hasRedirect = parsed?.searchParams.has('cio_redirect') ?? false;
  const rawCorrelation: Summary['rawCorrelation'] = { url };
  if (deliveryId) rawCorrelation.delivery = deliveryId;
  return {
    flags: {
      has_url: true,
      has_delivery_id: deliveryId != null,
      has_delivery_token: hasDeliveryToken,
      has_redirect: hasRedirect,
    },
    counts: {
      url_path_components: parsed
        ? parsed.pathname.split('/').filter(Boolean).length
        : 0,
      url_query_items: parsed ? [...parsed.searchParams.keys()].length : 0,
    },
    enums: {
      url_scheme: isWeb ? scheme! : scheme ? 'custom' : 'unknown',
      url_class:
        scheme === 'cio-live-activity'
          ? 'cio-live-activity'
          : isWeb
          ? 'web'
          : scheme
          ? 'custom-scheme'
          : 'other',
    },
    rawCorrelation,
  };
}

function appStateSummary(state: AppStateStatus | null): Summary {
  const appState =
    state === 'active' || state === 'inactive' || state === 'background'
      ? state
      : 'unknown';
  return { enums: { app_state: appState } };
}

async function waitForNativeReceipt(
  module: ProbeModule,
  attempts = 100
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = module.getNativeReceipt();
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

export function installLifecycleReceipts(): () => void {
  let module: ProbeModule;
  try {
    module = requireNativeModule<ProbeModule>('CioLifecycleProbe');
  } catch {
    return () => {};
  }
  const context = module.getHarnessContext();
  if (!context) return () => {};

  const recorder = new LifecycleJavascriptRecorder(
    context,
    BUFFER_CAPACITY,
    module
  );
  recorder.start();
  const removers: Array<() => void> = [];
  let finishStarted = false;
  const finish = () => {
    if (finishStarted) return;
    finishStarted = true;
    void recorder.end().then(() => waitForNativeReceipt(module));
  };
  const scenario = context.scenario;

  if (
    scenario === 'push-foreground' ||
    scenario === 'local-notification-foreground'
  ) {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        recorder.record(
          'wrapper.app-received-notification',
          'expo-javascript',
          'app-received',
          'entry',
          notificationSummary(notification)
        );
        finish();
      }
    );
    removers.push(() => subscription.remove());
  } else if (
    scenario === 'push-tap-warm' ||
    scenario === 'local-notification-tap-warm'
  ) {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        recorder.record(
          'wrapper.app-received-notification',
          'expo-javascript',
          'app-received',
          'entry',
          notificationSummary(response.notification, response.actionIdentifier)
        );
        finish();
      }
    );
    removers.push(() => subscription.remove());
  } else if (
    scenario === 'push-tap-cold' ||
    scenario === 'local-notification-tap-cold'
  ) {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      recorder.record(
        'wrapper.app-received-notification',
        'expo-javascript',
        'app-received',
        'entry',
        notificationSummary(response.notification, response.actionIdentifier)
      );
      finish();
    });
  } else if (
    scenario === 'custom-url-warm' ||
    scenario === 'universal-link-warm' ||
    scenario === 'live-activity-tap-warm'
  ) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      recorder.record(
        'wrapper.app-received-url',
        'expo-javascript',
        'app-received',
        'entry',
        urlSummary(url)
      );
      finish();
    });
    removers.push(() => subscription.remove());
  } else if (
    scenario === 'custom-url-cold' ||
    scenario === 'universal-link-cold' ||
    scenario === 'live-activity-tap-cold'
  ) {
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      recorder.record(
        'wrapper.app-received-url',
        'expo-javascript',
        'app-received',
        'entry',
        urlSummary(url)
      );
      finish();
    });
  } else if (scenario === 'icon-cold-launch') {
    const recordState = (state: AppStateStatus | null) => {
      recorder.record(
        'wrapper.app-lifecycle-state',
        'expo-javascript',
        'app-received',
        'state-change',
        appStateSummary(state)
      );
      if (state === 'active') finish();
    };
    const initialState = AppState.currentState;
    recordState(initialState);
    if (initialState !== 'active') {
      const subscription = AppState.addEventListener('change', recordState);
      removers.push(() => subscription.remove());
    }
  } else if (scenario === 'app-background-foreground') {
    let observedBackground = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') observedBackground = true;
      recorder.record(
        'wrapper.app-lifecycle-state',
        'expo-javascript',
        'app-received',
        'state-change',
        appStateSummary(state)
      );
      if (observedBackground && state === 'active') finish();
    });
    removers.push(() => subscription.remove());
  }

  return () => removers.forEach((remove) => remove());
}
