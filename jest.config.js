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
        '^.+\\.(js|ts)$': ['ts-jest', {
          tsconfig: path.resolve(__dirname, 'tsconfig.test.json'),
        }],
      },
      testEnvironment: 'node',
    },
  ],
};
