import { Logger, LogLevel, LogContext } from '../../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: {
    debug: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    // Reset singleton instance
    (Logger as any).instance = undefined;
    logger = Logger.getInstance();
    
    // Spy on console methods
    consoleSpy = {
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      
      expect(logger1).toBe(logger2);
      expect(logger1).toBeInstanceOf(Logger);
    });

    it('should maintain state across calls', () => {
      const logger1 = Logger.getInstance();
      logger1.setLogLevel(LogLevel.WARN);
      
      const logger2 = Logger.getInstance();
      
      // Both should have the same log level since they're the same instance
      logger2.info('test message');
      expect(consoleSpy.info).not.toHaveBeenCalled(); // Should not log because level is WARN
      
      logger2.warn('warn message');
      expect(consoleSpy.warn).toHaveBeenCalled(); // Should log because level is WARN
    });
  });

  describe('Log Levels', () => {
    it('should respect log level hierarchy', () => {
      logger.setLogLevel(LogLevel.WARN);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should filter messages below current level', () => {
      // Test DEBUG level (should log everything)
      logger.setLogLevel(LogLevel.DEBUG);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      // Test ERROR level (should only log errors)
      logger.setLogLevel(LogLevel.ERROR);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should change log level dynamically', () => {
      // Start with INFO level
      logger.setLogLevel(LogLevel.INFO);
      logger.debug('debug message 1');
      logger.info('info message 1');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      
      // Change to DEBUG level
      logger.setLogLevel(LogLevel.DEBUG);
      logger.debug('debug message 2');
      logger.info('info message 2');
      
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(2);
    });

    it('should handle default log level correctly', () => {
      // Default should be INFO
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      // Use a fixed date for consistent testing
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');
    });

    it('should format messages with timestamp', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.info('test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] INFO: test message'
      );
    });

    it('should include context in formatted message', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const context: LogContext = {
        domain: 'example.com',
        requestId: '123',
        endpoint: '/test'
      };
      
      logger.info('test message', context);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] INFO: test message | {"domain":"example.com","requestId":"123","endpoint":"/test"}'
      );
    });

    it('should handle missing context gracefully', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.info('test message without context');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] INFO: test message without context'
      );
    });

    it('should format error messages with stack traces', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test';
      
      const context: LogContext = { requestId: '123' };
      
      logger.error('error occurred', error, context);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] ERROR: error occurred | Error: Test error | Stack: Error: Test error\n    at test | {"requestId":"123"}'
      );
    });

    it('should handle error logging without error object', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const context: LogContext = { requestId: '123' };
      
      logger.error('error occurred', undefined, context);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] ERROR: error occurred | {"requestId":"123"}'
      );
    });

    it('should handle empty context objects', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.info('test message', {});
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] INFO: test message | {}'
      );
    });

    it('should format different log levels correctly', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] DEBUG: debug message'
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] INFO: info message'
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] WARN: warn message'
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[2024-01-01T12:00:00.000Z] ERROR: error message'
      );
    });

    it('should handle complex context objects', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const context: LogContext = {
        domain: 'example.com',
        requestId: '123',
        nested: {
          key: 'value',
          number: 42
        },
        array: [1, 2, 3]
      };
      
      logger.info('complex context', context);
      
      const expectedContext = JSON.stringify(context);
      expect(consoleSpy.info).toHaveBeenCalledWith(
        `[2024-01-01T12:00:00.000Z] INFO: complex context | ${expectedContext}`
      );
    });
  });

  describe('Output', () => {
    it('should output to appropriate console methods', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should not output when level is too low', () => {
      logger.setLogLevel(LogLevel.ERROR);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      
      logger.error('error message');
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple consecutive log calls', () => {
      logger.setLogLevel(LogLevel.INFO);
      
      logger.info('first message');
      logger.info('second message');
      logger.warn('third message');
      
      expect(consoleSpy.info).toHaveBeenCalledTimes(2);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null messages', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.info(null as any);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('null')
      );
    });

    it('should handle undefined messages', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.info(undefined as any);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('undefined')
      );
    });

    it('should handle very long messages', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const longMessage = 'a'.repeat(10000);
      
      logger.info(longMessage);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(longMessage)
      );
    });

    it('should handle circular reference in context', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const circularContext: any = { key: 'value' };
      circularContext.self = circularContext;
      
      // Should not throw an error, but handle the circular reference gracefully
      expect(() => {
        logger.info('circular context', circularContext);
      }).not.toThrow();
      
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should handle special characters in messages', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const specialMessage = 'Message with \n newlines \t tabs and "quotes" and \\backslashes';
      
      logger.info(specialMessage);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(specialMessage)
      );
    });

    it('should handle context with undefined values', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      const context: LogContext = {
        defined: 'value',
        undefined: undefined,
        null: null
      };
      
      logger.info('mixed context', context);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('{"defined":"value","undefined":null,"null":null}')
      );
    });
  });

  describe('Performance', () => {
    it('should not format messages when log level is too low', () => {
      logger.setLogLevel(LogLevel.ERROR);
      
      const expensiveContext = {
        get expensive() {
          throw new Error('This should not be called');
        }
      };
      
      // This should not throw because the message should not be formatted
      expect(() => {
        logger.debug('debug message', expensiveContext);
      }).not.toThrow();
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid log calls', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        logger.info(`message ${i}`, { iteration: i });
      }
      const end = Date.now();
      
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
      expect(consoleSpy.info).toHaveBeenCalledTimes(100);
    });
  });
});