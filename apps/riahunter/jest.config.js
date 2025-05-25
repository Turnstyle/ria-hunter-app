/* eslint-disable */
const { readFileSync } = require('fs');
const { pathsToModuleNameMapper } = require('ts-jest');
const path = require('path');

// Reading the tsconfig.base.json file to map paths
const tsConfigPath = path.join(__dirname, '../../tsconfig.base.json');
const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));

// Use compilerOptions.paths from tsconfig.base.json for Jest module name mapping
const importPaths = pathsToModuleNameMapper(tsConfig.compilerOptions.paths || {}, {
  prefix: '<rootDir>/../../', // Adjusted prefix to point to the monorepo root
});

module.exports = {
  displayName: 'riahunter',
  preset: '../../jest.preset.js', // Preserves the root preset's ts-jest config as a base
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest', // For non-source files
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json', // Use project-specific tsconfig for tests
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/riahunter',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Ensure this file exists or is created
  moduleNameMapper: {
    ...importPaths, // Spread the mapped paths
    // Handle module aliases (if you configured any in tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1', // This might be specific to app, ensure it's still needed or correct
  },
};
