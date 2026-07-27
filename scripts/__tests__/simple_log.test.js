import logMessage from '../simple_log';

describe('logMessage', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('should log the message with a timestamp', () => {
    const message = 'Test message';
    logMessage(message);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedOutput = consoleSpy.mock.calls[0][0];
    
    // Regex to match the timestamp format, e.g., "[2026-07-19T12:34:56.789Z] Test message"
    const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
    expect(loggedOutput).toMatch(timestampRegex);
    expect(loggedOutput).toContain(message);
  });
});