/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/cloud/client', () => ({supabase: {
  auth: {
    onAuthStateChange: jest.fn(() => ({data: {subscription: {unsubscribe: jest.fn()}}})),
    getSession: jest.fn(async () => ({data: {session: null}, error: null})),
    startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
  },
}}));

// The SQLite JSI adapter needs a native runtime; stub the app's database
// module so the tree renders instead of the DatabaseErrorFallback.
jest.mock('../src/watermelondb/database', () => ({
  database: {
    get: jest.fn(() => {
      throw new Error('no database in the render smoke test');
    }),
    write: jest.fn(async (work: () => Promise<unknown>) => work()),
    batch: jest.fn(),
  },
  getDatabaseError: () => null,
}));

test('renders correctly', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Continue with Google');
  await ReactTestRenderer.act(async () => renderer.unmount());
});
