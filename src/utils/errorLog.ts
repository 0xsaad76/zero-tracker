import StorageService from './asyncStorageService';

const ERROR_LOG_KEY = 'error_log';
const MAX_ENTRIES = 20;

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

    const raw = StorageService.getItemSync(ERROR_LOG_KEY);
    let entries: ErrorLogEntry[] = [];
    if (raw) {
      try {
        entries = JSON.parse(raw);
      } catch {
        entries = [];
      }
    }

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }

    StorageService.setItemSync(ERROR_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Storage itself failed — nothing we can do
  }
};

export const getErrorLog = (): ErrorLogEntry[] => {
  try {
    const raw = StorageService.getItemSync(ERROR_LOG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted log
  }
  return [];
};

export const clearErrorLog = (): void => {
  StorageService.removeItemSync(ERROR_LOG_KEY);
};
