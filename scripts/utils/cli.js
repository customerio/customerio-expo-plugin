const { execSync } = require("child_process");

// Logs a message with specified type and color
function logMessage(message, type = "info") {
  const colors = {
    debug: "\x1b[35m", // Magenta
    info: "\x1b[34m", // Blue
    success: "\x1b[32m", // Green
    warning: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
  };
  const resetColor = "\x1b[0m";
  console.log(`${colors[type] || ""}${message}${resetColor}`);
}

// Executes shell command and logs the command being run
function runCommand(command) {
  logMessage(`Running: ${command}`, "debug");
  execSync(command, { stdio: "inherit" });
}

// Executes `run` function safely, handling unexpected errors gracefully
function runScript(runFunction) {
  try {
    runFunction();
  } catch (error) {
    console.error(`❌ Script execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Retrieves the value of a CLI argument
// Supports `--flag=value` and `--flag value` formats
function getArgValue(flag, { default: defaultValue, required = false } = {}) {
  const index = process.argv.findIndex((arg) => arg.startsWith(flag));

  if (index !== -1) {
    const value = process.argv[index].split("=")[1] || process.argv[index + 1];
    return value !== undefined ? value : defaultValue;
  }

  if (required) {
    console.error(`❌ Missing required argument: ${flag}`);
    process.exit(1);
  }

  return defaultValue;
}

// Checks if a flag is set to true in CLI arguments
// Supports `--flag`, `--flag=1` and `--flag=true` formats
function isFlagEnabled(flag, { default: defaultValue = false } = {}) {
  // Checks for standalone flags
  if (process.argv.includes(flag)) {
    return true;
  }

  const arg = getArgValue(flag, { default: defaultValue }).toString().toLowerCase();
  return arg === "true" || arg === "1";
}

// Converts a CLI argument (`--arg=value1,value2`) into an array (`["value1", "value2"]`)
function parseArrayArg(flag, { default: defaultValue = "" } = {}) {
  const value = getArgValue(flag, { default: defaultValue });
  return value
    ? value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    : [];
}

// Parses CLI arguments into an object of key-value pairs ({ key: value })
// Supports `--key=value` format
function parseKeyValueArgs(args) {
  const updates = {};

  args.forEach((arg) => {
    // Skip standalone flags (e.g., --clear)
    if (!arg.includes("=")) {
      return;
    }

    const [key, value] = arg.split("=");
    if (!key || value === undefined) {
      logMessage(`❌ Invalid argument: ${arg}. Use format --key=value`, "error");
      process.exit(1);
    }
    updates[key.replace(/^--/, "").trim()] = value.trim();
  });

  return updates;
}

// Updates nested property in an object using dot notation by creating missing objects as needed
// e.g. setNestedValue(config, "ios.build.useFrameworks", "static");
function setNestedProperty(obj, path, value) {
  const keys = path.split(".");
  let current = obj;

  keys.slice(0, -1).forEach((key) => {
    current[key] = current[key] || {};
    current = current[key];
  });

  current[keys[keys.length - 1]] = value;
}


module.exports = {
  logMessage,
  runCommand,
  runScript,
  getArgValue,
  isFlagEnabled,
  parseArrayArg,
  parseKeyValueArgs,
  setNestedProperty,
};
