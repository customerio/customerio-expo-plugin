# Runtime capture boundary

No runtime capture is committed here. Source/hash checks are L0 and app
compile/link checks are L1. They do not establish callback behavior.

An L2 or L3 run is valid only when the harness supplies every required context
field, starts each recorder, delivers exactly one scenario stimulus, drains
each recorder through its final `trace.scenario-end`, writes the post-drain
receipts into the final manifest, and passes the canonical complete-capture
validator under `docs/dev-notes`.

Required native harness inputs are:

```text
CIO_LIFECYCLE_MANIFEST_ID
CIO_LIFECYCLE_RUN_ID
CIO_LIFECYCLE_STREAM_ID
CIO_LIFECYCLE_PROCESS_INSTANCE_ID
CIO_LIFECYCLE_SCENARIO
CIO_LIFECYCLE_EVIDENCE_LEVEL
CIO_LIFECYCLE_INTEGRATION
CIO_LIFECYCLE_RUNTIME
CIO_LIFECYCLE_PROVIDER
```

`CIO_LIFECYCLE_OUTPUT_PATH` is optional sink selection only. When present, the
Swift receipt is persisted after drain at
`${CIO_LIFECYCLE_OUTPUT_PATH}.receipt.json`; it is never appended to NDJSON.
The Expo bridge
also requires these explicit inputs:

```text
CIO_LIFECYCLE_JAVASCRIPT_STREAM_ID
CIO_LIFECYCLE_JAVASCRIPT_INTEGRATION=expo
CIO_LIFECYCLE_JAVASCRIPT_RUNTIME=javascript
CIO_LIFECYCLE_JAVASCRIPT_OUTPUT_PATH
```

The JavaScript output path must be distinct from the native output path. The
no-seat Expo module persists only closed, canonical JavaScript trace lines and
the post-drain receipt supplied by the JavaScript recorder. It does not observe
or forward a lifecycle callback. The JavaScript stream reuses the manifest,
run, process-instance, scenario,
evidence, and provider inputs above. Missing or invalid required context
disables the relevant recorder. Neither producer generates or repairs
identity.

Do not store raw notification payloads, tokens, URLs, identifiers, or device
identifiers in this directory. Contract-safe records use first-seen in-memory
aliases and safe summaries only.
