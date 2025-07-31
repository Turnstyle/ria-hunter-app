/* eslint-disable */
const { readFileSync } = require('fs');
const { pathsToModuleNameMapper } = require('ts-jest');
const path = require('path');

// Reading the project's tsconfig.json file to map paths
const projectTsConfigPath = path.join(__dirname, 'tsconfig.json');
const projectTsConfig = JSON.parse(readFileSync(projectTsConfigPath, 'utf-8'));

// Use compilerOptions.paths from the project's tsconfig.json for Jest module name mapping
const importPaths = pathsToModuleNameMapper(projectTsConfig.compilerOptions.paths || {}, {
  // The paths in tsconfig.json are relative to its baseUrl, which is "." (i.e., <rootDir> for this project)
  // The values in paths are like "../../libs/schemas/src/index.ts"
  // So, the prefix should make these paths relative to the monorepo root from Jest's perspective.
  // Since <rootDir> for this jest.config.js is apps/riahunter,
  // and paths like "../../libs/schemas/src/index.ts" are already relative from apps/riahunter
  // to the monorepo root level, the prefix should effectively be <rootDir>
  // to make them <rootDir>/../../libs/schemas/src/index.ts.
  prefix: '<rootDir>/',
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
    ...importPaths, // Spread the mapped paths from the project's tsconfig.json
    // Add other necessary general mappers if any, e.g., for CSS modules or assets if not handled by preset
    // Example: '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    // The alias '@/(.*)$': '<rootDir>/src/$1' might still be relevant if used
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
