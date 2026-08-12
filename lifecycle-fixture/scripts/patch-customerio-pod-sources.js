const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { assertSafeContainedPath } = require('./lib');

// Fixture-only patches for exact Customer.io iOS 4.7.2 CocoaPods sources.
// Run after `pod install`; no published plugin or SDK source is modified.

const REPO_ROOT = path.resolve(__dirname, '../..');
const GENERATED_FIXTURE_ROOT = path.join(REPO_ROOT, 'ci-test-apps');
const LOCK_PATH = path.join(__dirname, 'expo57-source-patch.lock.json');
const PATCHED_SNAPSHOT_ROOT = path.join(
  REPO_ROOT,
  '__tests__/fixtures/ios/expo57-patched'
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function arg(name) {
  const value = process.argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : undefined;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: exact patch anchor is absent or ambiguous`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const baseHelper = `
private let cioLifecycleProbeNotification = Notification.Name("io.customer.lifecycle-trace.probe.v1")

private func cioLifecycleProbeRecord(
  _ callback: String,
  owner: String,
  kind: String,
  phase: String,
  facts: [String: Any]
) {
  guard let processInstanceID = ProcessInfo.processInfo.environment["CIO_LIFECYCLE_PROCESS_INSTANCE_ID"] else {
    return
  }
  var userInfo = facts
  userInfo["callback"] = callback
  userInfo["owner"] = owner
  userInfo["kind"] = kind
  userInfo["phase"] = phase
  userInfo["process_instance_id"] = processInstanceID
  let center = NotificationCenter.default
  center.post(name: cioLifecycleProbeNotification, object: center, userInfo: userInfo)
}
`;

const notificationFactsHelper = `
private func cioLifecycleNotificationFacts(
  _ notification: UNNotification,
  response: UNNotificationResponse? = nil
) -> [String: Any] {
  let userInfo = notification.request.content.userInfo
  var correlation: [String: String] = ["request": notification.request.identifier]
  if let delivery = userInfo["CIO-Delivery-ID"] as? String {
    correlation["delivery"] = delivery
  }
  let isRemote = notification.request.trigger is UNPushNotificationTrigger
  let isCustomerIO = userInfo["CIO-Delivery-ID"] != nil && userInfo["CIO-Delivery-Token"] != nil
  var flags: [String: Bool] = [
    "has_notification": true,
    "has_notification_response": response != nil,
    "has_aps": userInfo["aps"] != nil,
    "has_delivery_id": userInfo["CIO-Delivery-ID"] != nil,
    "has_delivery_token": userInfo["CIO-Delivery-Token"] != nil
  ]
  var enums: [String: String] = [
    "notification_origin": isRemote ? "remote" : "local",
    "notification_class": isCustomerIO ? "customerio" : "non-customerio",
    "delegate_peer": "customerio-messaging-push"
  ]
  if let response {
    switch response.actionIdentifier {
    case UNNotificationDefaultActionIdentifier: enums["action_class"] = "default"
    case UNNotificationDismissActionIdentifier: enums["action_class"] = "dismiss"
    default: enums["action_class"] = "custom"
    }
    flags["has_notification_response"] = true
  }
  return [
    "flags": flags,
    "counts": ["notification_user_info_keys": userInfo.count],
    "enums": enums,
    "raw_correlation": correlation
  ]
}
`;

function patchNotificationDelegate(source) {
  source = replaceOnce(
    source,
    'import UIKit\n',
    `import UIKit\n${baseHelper}${notificationFactsHelper}`,
    'Customer.io notification delegate imports'
  );
  source = replaceOnce(
    source,
    '  ) {\n        if let wrappedNotificationCenterDelegate = wrappedNotificationCenterDelegate,',
    `  ) {
        cioLifecycleProbeRecord(
            "notification-center.will-present",
            owner: "notification-center-delegate",
            kind: "os-callback",
            phase: "entry",
            facts: cioLifecycleNotificationFacts(notification)
        )
        if let wrappedNotificationCenterDelegate = wrappedNotificationCenterDelegate,`,
    'Customer.io will-present raw ingress'
  );
  source = replaceOnce(
    source,
    '  ) {\n        // Cast to concrete type since method was removed from protocol\n        if let implementation = messagingPush as? MessagingPush {\n            _ = implementation.userNotificationCenter(center, didReceive: response)\n        }',
    `  ) {
        let lifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)
        cioLifecycleProbeRecord(
            "notification-center.did-receive-response",
            owner: "notification-center-delegate",
            kind: "os-callback",
            phase: "entry",
            facts: lifecycleFacts
        )
        // Cast to concrete type since method was removed from protocol
        let customerIOHandled: Bool
        if let implementation = messagingPush as? MessagingPush {
            customerIOHandled = implementation.userNotificationCenter(center, didReceive: response) != nil
        } else {
            customerIOHandled = false
        }
        let enums = lifecycleFacts["enums"] as? [String: String] ?? [:]
        if customerIOHandled,
           enums["notification_class"] == "customerio",
           enums["action_class"] == "default" {
            var terminalFacts = lifecycleFacts
            var terminalEnums = enums
            terminalEnums["result"] = "handled"
            terminalFacts["enums"] = terminalEnums
            cioLifecycleProbeRecord(
                "customerio.handle-notification-response",
                owner: "customerio-sdk",
                kind: "sdk-routing",
                phase: "result",
                facts: terminalFacts
            )
        }`,
    'Customer.io response terminal'
  );
  return source;
}

function patchAPNDelegate(source) {
  source = replaceOnce(
    source,
    'import UIKit\n',
    `import UIKit\n${baseHelper}`,
    'Customer.io APN delegate imports'
  );
  return replaceOnce(
    source,
    '        messagingPushAPN?.registerDeviceToken(apnDeviceToken: deviceToken)\n',
    `        if let messagingPushAPN {
            messagingPushAPN.registerDeviceToken(apnDeviceToken: deviceToken)
            cioLifecycleProbeRecord(
                "customerio.register-device-token",
                owner: "customerio-sdk",
                kind: "sdk-routing",
                phase: "result",
                facts: [
                    "flags": ["has_device_token": true],
                    "counts": ["device_token_bytes": deviceToken.count]
                ]
            )
        }
`,
    'Customer.io APN registration terminal'
  );
}

function patchFCMDelegate(source) {
  source = replaceOnce(
    source,
    'import UIKit\n',
    `import UIKit\n${baseHelper}`,
    'Customer.io FCM delegate imports'
  );
  return replaceOnce(
    source,
    '    public func didReceiveRegistrationToken(_ token: String?) {\n        if let wrappedFirebaseDelegate {',
    `    public func didReceiveRegistrationToken(_ token: String?) {
        if let token {
            let facts: [String: Any] = [
                "flags": ["has_fcm_token": true],
                "counts": ["fcm_token_characters": token.count]
            ]
            cioLifecycleProbeRecord(
                "fcm.registration-token-refreshed",
                owner: "fcm-messaging-delegate",
                kind: "framework-callback",
                phase: "entry",
                facts: facts
            )
        }
        if let wrappedFirebaseDelegate {`,
    'Customer.io FCM registration ingress'
  );
}

function finishFCMDelegate(source) {
  return replaceOnce(
    source,
    '        messagingPushFCM?.registerDeviceToken(fcmToken: token)\n',
    `        if let messagingPushFCM {
            messagingPushFCM.registerDeviceToken(fcmToken: token)
            if let token {
                cioLifecycleProbeRecord(
                    "customerio.register-device-token",
                    owner: "customerio-sdk",
                    kind: "sdk-routing",
                    phase: "result",
                    facts: [
                        "flags": ["has_fcm_token": true],
                        "counts": ["fcm_token_characters": token.count]
                    ]
                )
            }
        }
`,
    'Customer.io FCM registration terminal'
  );
}

const transforms = {
  customerioNotificationDelegate: {
    relativePath:
      'ios/Pods/CustomerIOMessagingPush/Sources/MessagingPush/Integration/CioNotificationCenterDelegate.swift',
    patch: patchNotificationDelegate,
  },
  customerioAPNDelegate: {
    relativePath:
      'ios/Pods/CustomerIOMessagingPushAPN/Sources/MessagingPushAPN/Integration/CioAppDelegateAPN.swift',
    patch: patchAPNDelegate,
  },
  customerioFCMDelegate: {
    relativePath:
      'ios/Pods/CustomerIOMessagingPushFCM/Sources/MessagingPushFCM/Integration/CioAppDelegateFCM.swift',
    patch: (source) => finishFCMDelegate(patchFCMDelegate(source)),
  },
};

function main() {
  const appPathValue = arg('--app-path');
  if (!appPathValue) throw new Error('Missing --app-path=<generated fixture>');
  assertSafeContainedPath(REPO_ROOT, GENERATED_FIXTURE_ROOT, {
    label: 'generated fixture root',
  });
  assertSafeContainedPath(REPO_ROOT, PATCHED_SNAPSHOT_ROOT, {
    label: 'patched snapshot root',
  });
  assertSafeContainedPath(REPO_ROOT, LOCK_PATH, {
    label: 'fixture patch lock',
  });
  const root = fs.realpathSync(GENERATED_FIXTURE_ROOT);
  const appPath = fs.realpathSync(path.resolve(REPO_ROOT, appPathValue));
  const relative = path.relative(root, appPath);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Refusing to patch outside ci-test-apps');
  }
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  const snapshot = arg('--snapshot');
  if (snapshot && !['apn', 'fcm'].includes(snapshot)) {
    throw new Error('--snapshot must be apn or fcm');
  }
  for (const [name, transform] of Object.entries(transforms)) {
    const candidatePath = path.join(appPath, transform.relativePath);
    if (!fs.existsSync(candidatePath)) continue;
    const filePath = assertSafeContainedPath(appPath, candidatePath, {
      label: `${name} Customer.io source`,
    });
    const source = fs.readFileSync(filePath, 'utf8');
    const before = sha256(source);
    const entry = lock.files[name];
    if (!entry || entry.path !== transform.relativePath) {
      throw new Error(`${name}: missing or mismatched lock entry`);
    }
    if (entry.postSha256.includes(before)) continue;
    if (!entry.preSha256.includes(before)) {
      throw new Error(`${name}: refused unexpected source hash ${before}`);
    }
    const patched = transform.patch(source);
    const after = sha256(patched);
    if (!entry.postSha256.includes(after)) {
      throw new Error(`${name}: patched hash ${after} is not locked`);
    }
    assertSafeContainedPath(appPath, filePath, {
      label: `${name} Customer.io source`,
    });
    fs.chmodSync(filePath, 0o644);
    assertSafeContainedPath(appPath, filePath, {
      label: `${name} Customer.io source`,
    });
    fs.writeFileSync(filePath, patched);
    process.stdout.write(`patched ${transform.relativePath}\n`);
  }
  if (snapshot) {
    const provenancePath = assertSafeContainedPath(
      PATCHED_SNAPSHOT_ROOT,
      path.join(PATCHED_SNAPSHOT_ROOT, 'PROVENANCE.json'),
      { allowMissing: true, label: 'patched snapshot provenance' }
    );
    const provenance = fs.existsSync(provenancePath)
      ? JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
      : {
          schema: 'cio-expo57-patched-source-snapshot/1',
          patchLock: path.relative(REPO_ROOT, LOCK_PATH),
          files: {},
        };
    for (const [name, transform] of Object.entries(transforms)) {
      const candidatePath = path.join(appPath, transform.relativePath);
      if (!fs.existsSync(candidatePath)) continue;
      const sourcePath = assertSafeContainedPath(appPath, candidatePath, {
        label: `${name} Customer.io source`,
      });
      const bytes = fs.readFileSync(sourcePath);
      const digest = sha256(bytes);
      if (!lock.files[name].postSha256.includes(digest)) {
        throw new Error(`${name}: refusing to snapshot non-post-patch bytes`);
      }
      const relative = `customerio-ios/${snapshot}/${path.basename(
        transform.relativePath
      )}`;
      const destination = path.join(PATCHED_SNAPSHOT_ROOT, relative);
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, destination, {
        allowMissing: true,
        label: `${name} Customer.io snapshot`,
      });
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, destination, {
        allowMissing: true,
        label: `${name} Customer.io snapshot`,
      });
      fs.writeFileSync(destination, bytes);
      provenance.files[relative] = { sha256: digest };
    }
    assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, provenancePath, {
      allowMissing: true,
      label: 'patched snapshot provenance',
    });
    fs.writeFileSync(
      provenancePath,
      `${JSON.stringify(provenance, null, 2)}\n`
    );
  }
}

if (require.main === module) main();

module.exports = { transforms, sha256 };
