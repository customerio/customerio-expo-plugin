const { parseString } = require('xml2js');
const g2js = require('gradle-to-js/lib/parser');
const fs = require('fs-extra');
const util = require('util');

// Convert parseString to Promise
const parseXmlString = util.promisify(parseString);

/**
 * Parses Android Manifest XML file
 * @param {string} filePath - Path to the manifest file
 * @returns {Promise<Object>} - Parsed manifest object
 */
async function parseAndroidManifest(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return parseXmlString(content);
}

/**
 * Parses Gradle file into JSON structure
 * @param {string} filePath - Path to the gradle file
 * @returns {Promise<Object>} - Parsed gradle object
 */
async function parseGradleFile(filePath) {
  return g2js.parseFile(filePath);
}

/**
 * Extracts sections from a file between markers
 * @param {string} filePath - Path to the file
 * @param {string} startMarker - Start marker string
 * @param {string} endMarker - End marker string
 * @returns {Promise<string>} - Content between markers
 */
async function extractContentBetweenMarkers(filePath, startMarker, endMarker) {
  const content = await fs.readFile(filePath, 'utf8');
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker, startIndex);
  
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not find markers in file: ${filePath}`);
  }
  
  return content.substring(
    startIndex + startMarker.length,
    endIndex
  ).trim();
}

/**
 * Extracts import statements from a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string[]>} - Array of import statements
 */
async function extractImports(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  
  return lines.filter(line => 
    line.trim().startsWith('#import') || 
    line.trim().startsWith('import')
  );
}

module.exports = {
  parseAndroidManifest,
  parseGradleFile,
  extractContentBetweenMarkers,
  extractImports
};