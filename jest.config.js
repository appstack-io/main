module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/', '/*.grpc_pb.js/', '/*.pb.js/'],
  coverageDirectory: './coverage',
  coverageReporters: [
    'json-summary',
    'text-summary',
    'cobertura',
    'lcov',
    'text',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/libs/client/**/*.*',
    '!src/main/index.ts',
    '!src/proto/**/*.*',
  ],
  forceExit: true,
  maxWorkers: 3,
  setupFiles: ['./jest.setup.js'],
};
