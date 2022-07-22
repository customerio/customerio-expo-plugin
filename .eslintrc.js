const config = require("expo-module-scripts/eslintrc.base.js");

if (!config.rules) config.rules = {};
if (!config.extends) config.extends = [];
if (!config.plugins) config.plugins = [];

config.rules["prettier/prettier"] = "error";
config.extends.push("prettier");
config.plugins.push("prettier");

module.exports = config;
