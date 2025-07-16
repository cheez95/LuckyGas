/**
 * Jest Configuration for LuckyGas Frontend Components
 * Configures testing environment, coverage, and module resolution
 */

export default {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Module file extensions
    moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],
    
    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.(test|spec).js',
        '**/*.(test|spec).js'
    ],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        'components/**/*.js',
        'state/**/*.js',
        'utils/**/*.js',
        'core/**/*.js',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/*.config.js',
        '!**/examples/**',
        '!**/migration-*.js'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    
    // Module name mapper for imports
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@components/(.*)$': '<rootDir>/components/$1',
        '^@state/(.*)$': '<rootDir>/state/$1',
        '^@utils/(.*)$': '<rootDir>/utils/$1',
        '^@core/(.*)$': '<rootDir>/core/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js'
    },
    
    // Transform files
    transform: {
        '^.+\\.js$': ['babel-jest', {
            presets: [
                ['@babel/preset-env', {
                    targets: {
                        node: 'current'
                    },
                    modules: 'auto'
                }]
            ]
        }]
    },
    
    // Setup files
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.js'
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    
    // Coverage reporters
    coverageReporters: ['text', 'lcov', 'html'],
    
    // Coverage directory
    coverageDirectory: 'coverage',
    
    // Root directory
    rootDir: '.',
    
    // Module paths
    modulePaths: ['<rootDir>'],
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/coverage/'
    ],
    
    // Transform ignore patterns
    transformIgnorePatterns: [
        '/node_modules/(?!(dompurify)/)'
    ]
};