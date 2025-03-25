/**
 * Jest setup file to initialize test environment
 */

const { setupMatchers } = require('./helpers/matchers');

// Initialize custom matchers
setupMatchers();

// Additional global setup if needed