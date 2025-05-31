module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/*.(test|spec).js'
  ],
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/content/',
    '/logs/',
    '/coverage/'
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'scripts/**/*.js',
    'config/**/*.js',
    '!scripts/**/dev-server.js',
    '!scripts/**/preview-server.js'
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
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}; 