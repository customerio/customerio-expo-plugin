const path = require('path');

module.exports = {
  projects: [
    {
      displayName: 'plugin',
      rootDir: path.resolve(__dirname, 'plugin'),
      testMatch: ['<rootDir>/__tests__/**/*.test.(js|ts)'],
      transform: {
        '^.+\\.(js|ts)$': 'ts-jest',
      },
      testEnvironment: 'node',
    },
    {
      displayName: 'test-app',
      rootDir: path.resolve(__dirname, 'test-app'),
      testMatch: ['<rootDir>/__tests__/**/*.test.(js|ts)'],
      transform: {
        '^.+\\.(js|ts)$': 'ts-jest',
      },
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'root-tests',
      rootDir: path.resolve(__dirname),
      testMatch: ['<rootDir>/__tests__/**/*.test.(js|ts)'],
      transform: {
        '^.+\\.(js|ts)$': 'ts-jest',
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    },
  ],
  // Global configuration for all projects
  testTimeout: 30000, // Increase timeout for tests that need to read files
  verbose: true,
};
