import ExpoModulesCore
import Foundation

/// A no-seat bridge. It exposes only harness context/control to JavaScript.
public final class CioLifecycleProbeModule: Module {
    private final class JavascriptSinkState: @unchecked Sendable {
        let lock = NSLock()
        var sink: FileLifecycleTraceSink?
    }

    private static let javascriptSinkState = JavascriptSinkState()

    public func definition() -> ModuleDefinition {
        Name("CioLifecycleProbe")

        Function("getHarnessContext") { () -> [String: Any]? in
            Self.javascriptContext()
        }

        Function("getNativeReceipt") { () -> [String: Any]? in
            Self.nativeReceipt()
        }

        Function("writeJavascriptTrace") { (line: String) -> Bool in
            Self.writeJavascriptTrace(line)
        }

        Function("writeJavascriptReceipt") { (json: String) -> Bool in
            Self.writeJavascriptReceipt(json)
        }
    }

    private static func javascriptContext(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> [String: Any]? {
        guard environment["CIO_LIFECYCLE_INTEGRATION"] == "expo",
              environment["CIO_LIFECYCLE_RUNTIME"] == "swift",
              environment["CIO_LIFECYCLE_JAVASCRIPT_INTEGRATION"] == "expo",
              environment["CIO_LIFECYCLE_JAVASCRIPT_RUNTIME"] == "javascript",
              let manifestID = environment["CIO_LIFECYCLE_MANIFEST_ID"],
              let runID = environment["CIO_LIFECYCLE_RUN_ID"],
              let streamID = environment["CIO_LIFECYCLE_JAVASCRIPT_STREAM_ID"],
              let processInstanceID = environment["CIO_LIFECYCLE_PROCESS_INSTANCE_ID"],
              let hostTopologyValue = environment["CIO_LIFECYCLE_HOST_TOPOLOGY"],
              let hostTopology = LifecycleTraceHostTopology(rawValue: hostTopologyValue),
              let activationOccurrenceIdentity = environment[
                  "CIO_LIFECYCLE_ACTIVATION_OCCURRENCE_ID"
              ],
              let nativeOutputPath = environment["CIO_LIFECYCLE_OUTPUT_PATH"],
              let javascriptOutputPath = environment["CIO_LIFECYCLE_JAVASCRIPT_OUTPUT_PATH"],
              !nativeOutputPath.isEmpty,
              !javascriptOutputPath.isEmpty,
              nativeOutputPath != javascriptOutputPath,
              let scenarioValue = environment["CIO_LIFECYCLE_SCENARIO"],
              let scenario = LifecycleTraceScenario(rawValue: scenarioValue),
              LifecycleTraceExpoSupport.supports(scenario),
              let evidenceValue = environment["CIO_LIFECYCLE_EVIDENCE_LEVEL"],
              let evidence = LifecycleTraceEvidenceLevel(rawValue: evidenceValue),
              let providerValue = environment["CIO_LIFECYCLE_PROVIDER"],
              let provider = LifecycleTraceProvider(rawValue: providerValue),
              LifecycleTraceHarness.sharedRecorder != nil,
              LifecycleTraceContext(
                  manifestID: manifestID,
                  runID: runID,
                  streamID: streamID,
                  processID: nil,
                  processInstanceID: processInstanceID,
                  integration: .expo,
                  runtime: .javascript,
                  provider: provider,
                  scenario: scenario,
                  evidenceLevel: evidence,
                  hostTopology: hostTopology,
                  activationOccurrenceIdentity: activationOccurrenceIdentity
              ) != nil else {
            return nil
        }
        return [
            "manifestId": manifestID,
            "runId": runID,
            "javascriptStreamId": streamID,
            "processInstanceId": processInstanceID,
            "hostTopology": hostTopology.rawValue,
            "activationOccurrenceId": activationOccurrenceIdentity,
            "scenario": scenario.rawValue,
            "evidenceLevel": evidence.rawValue,
            "integration": "expo",
            "runtime": "javascript",
            "provider": provider.rawValue,
        ]
    }

    private static func nativeReceipt(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> [String: Any]? {
        guard let outputPath = environment["CIO_LIFECYCLE_OUTPUT_PATH"],
              !outputPath.isEmpty else {
            return nil
        }
        let receiptPath = outputPath + FileLifecycleTraceSink.receiptPathSuffix
        guard let data = FileManager.default.contents(atPath: receiptPath),
              let object = try? JSONSerialization.jsonObject(with: data),
              let receipt = object as? [String: Any] else {
            return nil
        }
        return receipt
    }

    private static func writeJavascriptTrace(
        _ line: String,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        guard !line.contains("\n"),
              line.utf8.count <= 64 * 1024,
              line.hasPrefix(LifecycleTraceRecorder.linePrefix),
              let object = jsonObject(String(line.dropFirst(LifecycleTraceRecorder.linePrefix.count))),
              object["schema"] as? String == "cio-lifecycle-trace/1",
              object["manifest_id"] as? String == environment["CIO_LIFECYCLE_MANIFEST_ID"],
              object["run_id"] as? String == environment["CIO_LIFECYCLE_RUN_ID"],
              object["stream_id"] as? String == environment["CIO_LIFECYCLE_JAVASCRIPT_STREAM_ID"],
              object["integration"] as? String == "expo",
              object["runtime"] as? String == "javascript" else {
            return false
        }
        let state = javascriptSinkState
        state.lock.lock()
        defer { state.lock.unlock() }
        guard let sink = javascriptSink(environment: environment, state: state) else { return false }
        return sink.write(line: line)
    }

    private static func writeJavascriptReceipt(
        _ json: String,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        guard !json.contains("\n"),
              json.utf8.count <= 64 * 1024,
              let object = jsonObject(json),
              object["last_assigned_sequence"] is NSNumber,
              object["last_emitted_sequence"] is NSNumber,
              object["emitted_records"] is NSNumber else {
            return false
        }
        let state = javascriptSinkState
        state.lock.lock()
        defer { state.lock.unlock() }
        guard let sink = javascriptSink(environment: environment, state: state) else { return false }
        return sink.writeReceipt(json: json)
    }

    private static func javascriptSink(
        environment: [String: String],
        state: JavascriptSinkState
    ) -> FileLifecycleTraceSink? {
        if let sink = state.sink { return sink }
        guard let nativePath = environment["CIO_LIFECYCLE_OUTPUT_PATH"],
              let javascriptPath = environment["CIO_LIFECYCLE_JAVASCRIPT_OUTPUT_PATH"],
              !nativePath.isEmpty,
              !javascriptPath.isEmpty,
              nativePath != javascriptPath,
              let sink = FileLifecycleTraceSink(path: javascriptPath) else {
            return nil
        }
        state.sink = sink
        return sink
    }

    private static func jsonObject(_ json: String) -> [String: Any]? {
        guard let data = json.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data),
              let object = value as? [String: Any] else {
            return nil
        }
        return object
    }
}
