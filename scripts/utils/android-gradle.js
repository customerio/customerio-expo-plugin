// Pure helpers for editing a generated Android project's Gradle files. The
// compatibility scripts use them on android/gradle.properties and
// android/app/build.gradle after `expo prebuild`.

// Matches every `key=value` / `key: value` line for a property, ignoring surrounding whitespace.
function gradlePropertyPattern(key) {
  return new RegExp(`^[ \\t]*${key.replace(/\./g, "\\.")}[ \\t]*[=:].*$`, "gm");
}

// Returns a property's effective value (Gradle keeps the last definition), or undefined if unset.
function readGradleProperty(contents, key) {
  const lines = contents.match(gradlePropertyPattern(key)) || [];
  const last = lines[lines.length - 1];
  return last === undefined ? undefined : last.replace(/^[^=:]*[=:]/, "").trim();
}

// Returns the contents with each property set: every existing definition is
// replaced, and a property the file doesn't define yet is appended.
function setGradleProperties(contents, properties) {
  let updated = contents;
  for (const [key, value] of Object.entries(properties)) {
    const line = `${key}=${value}`;
    updated = gradlePropertyPattern(key).test(updated)
      ? updated.replace(gradlePropertyPattern(key), line)
      : `${updated.trimEnd()}\n${line}\n`;
  }
  return updated;
}

// Plugin IDs of the Kotlin Android Gradle plugin, which AGP 9's built-in Kotlin replaces.
const KOTLIN_ANDROID_PLUGIN_IDS = ["org.jetbrains.kotlin.android", "kotlin-android"];

// Returns the build script without its `apply plugin: "<Kotlin Android>"` lines.
// AGP 9 registers the `kotlin` extension itself when built-in Kotlin is on, so a
// module that also applies the Kotlin plugin fails to configure.
function removeKotlinAndroidPlugin(buildGradle) {
  const ids = KOTLIN_ANDROID_PLUGIN_IDS.map((id) => id.replace(/\./g, "\\.")).join("|");
  return buildGradle.replace(
    new RegExp(`^[ \\t]*apply[ \\t]+plugin:[ \\t]*["'](?:${ids})["'][^\\n]*\\n?`, "gm"),
    "",
  );
}

module.exports = {
  readGradleProperty,
  setGradleProperties,
  removeKotlinAndroidPlugin,
};
