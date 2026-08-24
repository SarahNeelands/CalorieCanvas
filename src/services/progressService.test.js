const mockApiRequest = jest.fn();
jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));

import {
  createWeightEntry,
  deleteCalorieEntry,
  deleteWeightEntry,
  fetchCalorieSeries,
  fetchWeightSeries,
  fetchExerciseSeries,
  fetchWeightSummary,
  getLocalWeightImportState,
  importLocalWeightHistory,
  replaceCalorieDayTotal,
} from './progressService';

beforeEach(() => {
  localStorage.clear();
  mockApiRequest.mockReset();
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') },
  });
});

test('Express mode preserves the existing normalized chart point shape and date string', async () => {
  mockApiRequest.mockResolvedValue({
    payload: {
      data: [{
        id: 'b', date: '2025-01-01', value: 176.3698, unit: 'lb',
        value_kg: 80.000012, created_at: '2025-01-01T12:00:00.000Z',
      }],
    },
    error: null,
  });
  const points = await fetchWeightSeries('ignored-session-owner');
  expect(mockApiRequest).toHaveBeenCalledWith('/weights?limit=365');
  expect(points).toEqual([{
    id: 'b', date: '2025-01-01', label: expect.any(String), value: 80,
    extra: { rawValue: 176.3698, rawUnit: 'lb', createdAt: '2025-01-01T12:00:00.000Z' },
  }]);
});

test('Express writes use CSRF and do not send client ownership', async () => {
  mockApiRequest.mockResolvedValue({ payload: { data: { id: 'server-id' } }, error: null });
  await createWeightEntry('client-user-id', { date: '2025-01-02', value: 80, unit: 'kg' });
  expect(mockApiRequest).toHaveBeenCalledWith('/weights', {
    method: 'POST', csrf: true, body: { date: '2025-01-02', value: 80, unit: 'kg' },
  });
  mockApiRequest.mockResolvedValueOnce({ payload: null, error: null });
  await deleteWeightEntry('client-user-id', { id: 'weight-id' });
  expect(mockApiRequest).toHaveBeenLastCalledWith('/weights/weight-id', { method: 'DELETE', csrf: true });
});


test('browser import is explicit, retry-stable, and never removes cc.weights', async () => {
  const localRecords = [{ date: '2025-01-01', value: 80, unit: 'kg' }];
  localStorage.setItem('cc.weights', JSON.stringify(localRecords));
  expect(getLocalWeightImportState('session-user')).toEqual({ available: true, count: 1 });
  mockApiRequest.mockResolvedValueOnce({ payload: null, error: { message: 'failed' } });
  await expect(importLocalWeightHistory('session-user')).rejects.toThrow('failed');
  expect(JSON.parse(localStorage.getItem('cc.weights'))).toEqual(localRecords);
  const firstBody = mockApiRequest.mock.calls[0][1].body;

  mockApiRequest.mockResolvedValueOnce({
    payload: { data: { imported: 1, duplicate: 0, invalid: 0, committed: true } }, error: null,
  });
  await expect(importLocalWeightHistory('session-user')).resolves.toMatchObject({ imported: 1 });
  expect(mockApiRequest.mock.calls[1][1].body.operationId).toBe(firstBody.operationId);
  expect(JSON.parse(localStorage.getItem('cc.weights'))).toEqual(localRecords);
});

test('summary returns the backend authoritative calculation unchanged', async () => {
  const summary = { startingWeightKg: 80, latestWeightKg: 78, totalChangeKg: -2, direction: 'loss' };
  mockApiRequest.mockResolvedValue({ payload: { data: summary }, error: null });
  await expect(fetchWeightSummary({ startDate: '2025-01-01', endDate: '2025-02-01' })).resolves.toEqual(summary);
  expect(mockApiRequest).toHaveBeenCalledWith('/weights/summary?start_date=2025-01-01&end_date=2025-02-01');
});

test('calorie progress reads and deletes through Express without a browser or Supabase fallback', async () => {
  mockApiRequest.mockResolvedValueOnce({
    payload: { data: [{ date: '2025-01-03', total_kcal: '1234.5' }] }, error: null,
  });
  await expect(fetchCalorieSeries('ignored-owner')).resolves.toEqual([{
    date: '2025-01-03', label: expect.any(String), value: 1234.5,
    extra: { calories: 1234.5 },
  }]);
  expect(mockApiRequest).toHaveBeenLastCalledWith('/meal-logs/summary');

  mockApiRequest.mockResolvedValueOnce({ payload: null, error: null });
  await deleteCalorieEntry('ignored-owner', { date: '2025-01-03' });
  expect(mockApiRequest).toHaveBeenLastCalledWith('/meal-logs/day/2025-01-03', {
    method: 'DELETE', csrf: true,
  });

  mockApiRequest.mockResolvedValueOnce({ payload: null, error: { message: 'API failed' } });
  await expect(fetchCalorieSeries('ignored-owner')).rejects.toThrow('API failed');
});

test('editing a calorie day to zero deletes it without creating a replacement entry', async () => {
  mockApiRequest.mockResolvedValueOnce({ payload: null, error: null });
  await expect(replaceCalorieDayTotal('session-user', {
    date: '2025-01-03',
    calories: 0,
  })).resolves.toBeNull();
  expect(mockApiRequest).toHaveBeenCalledTimes(1);
  expect(mockApiRequest).toHaveBeenCalledWith('/meal-logs/day/2025-01-03', {
    method: 'DELETE', csrf: true,
  });
});

test('Express exercise progress merges stable local/server IDs without doubling minutes', async () => {
  localStorage.setItem('exercise_page_state_v3', JSON.stringify({
    userId: 'session-user', exerciseTypes: [{ id: 'walk', name: 'Walking' }],
    logs: [{ id: 'stable-log', userId: 'session-user', typeId: 'walk', minutes: 30, timestampISO: '2025-01-01T12:00:00.000Z' }],
  }));
  mockApiRequest.mockResolvedValue({ payload: { data: [{
    id: 'stable-log', serverId: '11111111-1111-4111-8111-111111111111',
    user_id: 'session-user', definition_id: 'walk', duration_minutes: 30,
    occurred_at: '2025-01-01T12:00:00.000Z', log_date: '2025-01-01',
    definition_snapshot: { name: 'Walking' },
  }] }, error: null });
  await expect(fetchExerciseSeries('session-user')).resolves.toEqual([{
    date: '2025-01-01', label: expect.any(String), value: 30,
    extra: { types: [{ name: 'Walking', minutes: 30 }] },
  }]);
});
