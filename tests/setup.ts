// Test setup file
import { jest } from '@jest/globals';

// Mock console.log and console.error in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory SQLite for tests
