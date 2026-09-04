import {moveLegacyData, readLegacyData} from '../src/cloud/legacy';
import {mutateCloudData, readCloudData, requireCloudUser, type CloudData} from '../src/cloud/records';
import {database} from '../src/watermelondb/database';
import StorageService from '../src/utils/asyncStorageService';

jest.mock('../src/cloud/records', () => ({
  mutateCloudData: jest.fn(),
  readCloudData: jest.fn(),
  requireCloudUser: jest.fn(),
}));
jest.mock('../src/watermelondb/database', () => ({
  database: {write: jest.fn(async work => work()), unsafeResetDatabase: jest.fn(async () => {}), get: jest.fn()},
}));

const empty = (): CloudData => ({
  users: [],
  categories: [],
  expenses: [],
  currencies: [],
  debtors: [],
  debts: [],
  budgets: [],
});
let cloud: CloudData;
let local: CloudData;
beforeEach(() => {
  jest.clearAllMocks();
  StorageService.clearSync();
  cloud = empty();
  local = {
    ...empty(),
    users: [{id: 'old-user', username: 'Old', email: ''}],
    categories: [{id: 'food', userId: 'old-user', name: 'Food', categoryStatus: false, icon: '', color: '#808080'}],
    expenses: [
      {
        id: 'one',
        userId: 'old-user',
        title: 'Lunch',
        amount: 50,
        description: '',
        categoryId: 'food',
        date: '2026-09-04',
      },
    ],
    currencies: [{id: 'old-currency', userId: 'old-user', code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
    budgets: [
      {
        id: 'limit',
        userId: 'old-user',
        amount: 500,
        month: 'recurring:2026-09',
        categoryId: 'food',
        budgetType: 'monthly',
      },
    ],
  };
  jest.mocked(requireCloudUser).mockImplementation(id => {
    if (id !== undefined && id !== 'new-user') throw new Error('Account changed');
    return 'new-user';
  });
  jest.mocked(mutateCloudData).mockImplementation(async mutation => {
    const draft: CloudData = JSON.parse(JSON.stringify(cloud));
    const result = mutation(draft);
    cloud = draft;
    return result;
  });
  jest.mocked(readCloudData).mockImplementation(async () => JSON.parse(JSON.stringify(cloud)));
});

it('never opens SQLite for a fresh cloud installation', async () => {
  expect(await readLegacyData()).toBeNull();
  expect(database.get).not.toHaveBeenCalled();
});
it('remaps relationships and preserves soft-deleted categories before verified removal', async () => {
  await moveLegacyData(local);
  expect(cloud.expenses[0]).toMatchObject({
    id: 'sqlite:one',
    userId: 'new-user',
    categoryId: 'sqlite:food',
    amount: 50,
  });
  expect(cloud.categories[0].categoryStatus).toBe(false);
  expect(cloud.budgets[0].categoryId).toBe('sqlite:food');
  expect(database.unsafeResetDatabase).toHaveBeenCalledTimes(1);
  expect(jest.mocked(readCloudData).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(database.unsafeResetDatabase).mock.invocationCallOrder[0],
  );
  expect(StorageService.getBoolean('cloudMigrationComplete')).toBe(true);
});
it('keeps local data on verification failure and safely retries without duplicate imports', async () => {
  jest.mocked(readCloudData).mockRejectedValueOnce(new Error('offline'));
  await expect(moveLegacyData(local)).rejects.toThrow('offline');
  expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
  await moveLegacyData(local);
  expect(cloud.expenses).toHaveLength(1);
  expect(database.unsafeResetDatabase).toHaveBeenCalledTimes(1);
});
it('does not erase a changed local record merely because its ID was previously imported', async () => {
  jest.mocked(readCloudData).mockRejectedValueOnce(new Error('offline'));
  await expect(moveLegacyData(local)).rejects.toThrow();
  local.expenses[0].amount = 75;
  await expect(moveLegacyData(local)).rejects.toThrow('differ');
  expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
  expect(cloud.expenses[0].amount).toBe(50);
});
it('blocks a different-currency merge without uploading or deleting records', async () => {
  cloud.currencies = [{id: 'new-user', userId: 'new-user', code: 'USD', symbol: '$', name: 'US Dollar'}];
  await expect(moveLegacyData(local)).rejects.toThrow('different currency');
  expect(cloud.expenses).toHaveLength(0);
  expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
});
it('keeps the device copy if verification finds a missing record', async () => {
  jest.mocked(readCloudData).mockImplementationOnce(async () => ({...cloud, expenses: []}));
  await expect(moveLegacyData(local)).rejects.toThrow('differ');
  expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
});
it('does not erase SQLite after an account change', async () => {
  jest.mocked(readCloudData).mockImplementationOnce(async () => {
    jest.mocked(requireCloudUser).mockImplementation(() => {
      throw new Error('Account changed');
    });
    return cloud;
  });
  await expect(moveLegacyData(local)).rejects.toThrow('Account changed');
  expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
});
