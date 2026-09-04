import StorageService from './asyncStorageService';

const ERROR_LOG_KEY = 'error_log';
const MAX_ENTRIES = 20;
let sessionEntries: ErrorLogEntry[] = [];

interface ErrorLogEntry {
  timestamp: string;
  message: string;
  stack: string;
  fatal: boolean;
}

export const appendErrorLog = (error: Error, fatal: boolean = false): void => {
  try {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      message: error.message?.slice(0, 200) || 'Unknown error',
      stack: (error.stack || '').slice(0, 500),
      fatal,
    };

    // Error text can contain record identifiers. Keep diagnostics in RAM only.
    sessionEntries = [...sessionEntries, entry].slice(-MAX_ENTRIES);
  } catch {
    // Storage itself failed — nothing we can do
  }
};

export const getErrorLog = (): ErrorLogEntry[] => {
  return [...sessionEntries];
};

export const clearErrorLog = (): void => {
  sessionEntries = [];
  StorageService.removeItemSync(ERROR_LOG_KEY);
};
