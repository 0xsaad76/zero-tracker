import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {schema} from './schema';
import {migrations} from './migrations';
import {User, Category, Expense, Currency, Debtor, Debt, Budget} from './models';

let _database: Database | null = null;
let _databaseError: Error | null = null;

/**
 * Returns the database setup error if initialization failed.
 * Check this in App.tsx to show a user-facing fallback.
 */
export const getDatabaseError = (): Error | null => _databaseError;

const getDatabase = (): Database => {
  if (_databaseError) {
    throw _databaseError;
  }

  if (!_database) {
    try {
      const adapter = new SQLiteAdapter({
        schema,
        migrations,
        jsi: true,
        onSetUpError: error => {
          _databaseError = error instanceof Error ? error : new Error(String(error));
          if (__DEV__) {
            console.error('WatermelonDB setup error:', error);
          }
        },
      });

      _database = new Database({
        adapter,
        modelClasses: [User, Category, Expense, Currency, Debtor, Debt, Budget],
      });
    } catch (error) {
      _databaseError = error instanceof Error ? error : new Error(String(error));
      throw _databaseError;
    }
  }
  return _database;
};

export const database = new Proxy({} as Database, {
  get(_target, prop) {
    const db = getDatabase();
    const value = db[prop as keyof Database];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  },
});

export {getDatabase};
export default database;
