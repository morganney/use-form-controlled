module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**/*.js', '!**/node_modules/**'],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'text-summary'],
  modulePathIgnorePatterns: ['dist'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.js']
}
