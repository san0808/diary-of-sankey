module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/*.(test|spec).js'
  ],
  
  // Coverage settings - only collect when explicitly requested
  collectCoverage: process.env.COVERAGE === 'true' || process.argv.includes('--coverage'),
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/content/',
    '/logs/',
    '/coverage/',
    '/scripts/utils/__mocks__/' // Ignore mock files
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'scripts/**/*.js',
    'config/**/*.js',
    '!scripts/**/dev-server.js',
    '!scripts/**/preview-server.js',
    '!scripts/utils/__mocks__/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  modulePaths: ['<rootDir>'],
  
  // Transform settings
  transform: {},
  
  // Mock settings
  clearMocks: true,
  restoreMocks: true,
  
  // Timeout settings
  testTimeout: process.env.CI ? 15000 : 10000,
  
  // Verbose output - suppress in CI for cleaner logs
  verbose: !process.env.CI,
  
  // Silent mode for CI to reduce noise
  silent: process.env.CI === 'true',
  
  // CI-specific optimizations
  ...(process.env.CI && {
    maxWorkers: '50%',
    cache: false,
    forceExit: true,
    detectOpenHandles: true
  }),
  
  // Coverage thresholds - only apply when coverage is being collected
  ...(((process.env.COVERAGE === 'true') || process.argv.includes('--coverage')) && {
    coverageThreshold: {
      global: {
        branches: 9,
        functions: 9,
        lines: 9,
        statements: 9
      }
    }
  })
}; 