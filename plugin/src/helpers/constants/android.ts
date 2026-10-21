export const CIO_PROJECT_BUILDSCRIPTS_REGEX =
  /(buildscript\s*\{(.|\n)*dependencies\s*\{)/;
export const CIO_APP_APPLY_REGEX = /(apply plugin: "com.android.application")/;
export const CIO_PROJECT_ALLPROJECTS_REGEX =
  /(allprojects\s*\{(.|\n){1,500}repositories\s*\{)/;

export const CIO_APP_GOOGLE_SNIPPET =
  'apply plugin: "com.google.gms.google-services"  // Google Services plugin';
// 4.4.0 is the oldest release that applies under AGP 9's new DSL (`android.newDsl=true`); 4.3.x
// reads the removed `applicationVariants`. Gradle resolves the highest declared version, so an
// app that declares a newer google-services keeps it.
export const CIO_PROJECT_GOOGLE_SNIPPET =
  '        classpath "com.google.gms:google-services:4.4.0"  // Google Services plugin';
// Any version of the classpath line this plugin injects, so an incremental prebuild replaces an
// older one instead of adding a second line.
export const CIO_PROJECT_GOOGLE_SNIPPET_ANY_VERSION_REGEX =
  /^[ \t]*classpath "com\.google\.gms:google-services:[^"\n]+" {2}\/\/ Google Services plugin$/m;

export const CIO_MAINAPPLICATION_ONCREATE_REGEX = /override\s+fun\s+onCreate\s*\(\s*\)\s*\{[\s\S]*?\}/;
// Actual method call, also used to detect if Customer.io auto initialization is already present
export const CIO_NATIVE_SDK_INITIALIZE_CALL = 'CustomerIOSDKInitializer.initialize(this)';
// Complete code snippet to inject into MainActivity.onCreate()
export const CIO_NATIVE_SDK_INITIALIZE_SNIPPET = `// Auto Initialize Native Customer.io SDK
    ${CIO_NATIVE_SDK_INITIALIZE_CALL}`;
