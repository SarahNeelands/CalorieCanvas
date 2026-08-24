const mockApiRequest = jest.fn();
const mockGetCurrentUserId = jest.fn();
const mockGetStoredUserId = jest.fn();
const catalogItem = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Oatmeal', type: 'meal', item_type: 'meal', unit_conversions: {}, food_id: null,
  kcal_per_100g: 120, protein_g_per_100g: 4, carbs_g_per_100g: 21, fat_g_per_100g: 2,
};

jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));
jest.mock('./authClient', () => ({
  getCurrentUserId: (...args) => mockGetCurrentUserId(...args),
  getStoredUserId: (...args) => mockGetStoredUserId(...args),
}));
jest.mock('./catalogClient', () => ({
  getCachedCatalogItems: (type) => (type === 'meal' ? [catalogItem] : []),
}));

import {
  createMealLog,
  createGuestimateMealLog,
  deleteMealLog,
  deleteMealLogDay,
  getDailyMealLogSummary,
  getMealLogDailyTotals,
  getMealLogDay,
  listMealLogRange,
  listMealLogs,
  updateMealLog,
} from './mealLogClient';

function payload(overrides = {}) {
  return {
    user_id: 'client-owner', meal_id: catalogItem.id, food_id: null, qty: '2', unit_code: 'g',
    grams_resolved: 2, logged_at: '2026-03-08T06:30:00.000Z', kcal: 2.4,
    protein_g: 0.08, carbs_g: 0.42, fat_g: 0.04, fiber_g: 0.1,
    micros: { sodium: 1 }, ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  mockApiRequest.mockReset();
  mockGetCurrentUserId.mockReset();
  mockGetCurrentUserId.mockResolvedValue('session-user');
  mockGetStoredUserId.mockReset();
  mockGetStoredUserId.mockReturnValue('session-user');
});

test('Express create preserves entry shape, snapshots the catalog item, and never sends ownership', async () => {
  const entry = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...payload(), user_id: 'session-user', meal: catalogItem };
  mockApiRequest.mockResolvedValue({ payload: { data: entry }, error: null });

  await expect(createMealLog(payload())).resolves.toEqual(entry);
  const [path, options] = mockApiRequest.mock.calls[0];
  expect(path).toBe('/meal-logs/entries');
  expect(options).toEqual(expect.objectContaining({ method: 'POST', csrf: true }));
  expect(options.body.user_id).toBeUndefined();
  expect(options.body.userId).toBeUndefined();
  expect(options.body.item_snapshot).toEqual(expect.objectContaining({
    id: catalogItem.id, title: 'Oatmeal', type: 'meal',
  }));
  expect(options.body.log_date).toBe('2026-03-08');
  const shifted = new Date(Date.parse(options.body.logged_at) + options.body.timezone_offset_minutes * 60_000)
    .toISOString().slice(0, 10);
  expect(shifted).toBe(options.body.log_date);
});

test('Express list, range, day, and summary calls retain normalized response shapes and date-only serialization', async () => {
  const entry = { id: 'entry-1', meal_id: catalogItem.id, meal: catalogItem, logged_at: '2026-11-01T05:30:00.000Z' };
  const totals = { calories: 120, protein_g: 4, count: 1 };
  const day = { date: '2026-11-01', meals: [{ meal_type: 'breakfast', entries: [entry] }], totals };
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: [entry] }, error: null })
    .mockResolvedValueOnce({ payload: { data: [entry] }, error: null })
    .mockResolvedValueOnce({ payload: { data: day }, error: null })
    .mockResolvedValueOnce({ payload: { data: totals }, error: null });

  await expect(listMealLogs({ limit: 3 })).resolves.toEqual([entry]);
  await expect(listMealLogRange({ startDate: '2026-11-01', endDate: '2026-11-01' })).resolves.toEqual([entry]);
  await expect(getMealLogDay({ date: '2026-11-01' })).resolves.toEqual(day);
  await expect(getDailyMealLogSummary({ date: '2026-11-01' })).resolves.toEqual(totals);
  expect(mockApiRequest.mock.calls.map((call) => call[0])).toEqual([
    '/meal-logs?limit=3',
    '/meal-logs?start_date=2026-11-01&end_date=2026-11-01&limit=500',
    '/meal-logs/days/2026-11-01',
    '/meal-logs/days/2026-11-01/summary',
  ]);
});

test('Guestimate Meal creates a one-time ad hoc calorie-only entry', async () => {
  const entry = { id: 'guestimate-entry', kcal: 650, meal: { title: 'Guestimate Meal' } };
  mockApiRequest.mockResolvedValue({ payload: { data: entry }, error: null });

  await expect(createGuestimateMealLog({
    userId: 'session-user',
    calories: 650,
    date: '2026-03-08',
    loggedAt: '2026-03-08T17:00:00.000Z',
  })).resolves.toEqual(entry);

  const [, options] = mockApiRequest.mock.calls[0];
  expect(options.body.meal_id).toBeUndefined();
  expect(options.body.item_snapshot).toEqual(expect.objectContaining({
    title: 'Guestimate Meal',
    type: 'meal',
    kcal_per_100g: 650,
  }));
  expect(options.body.qty).toBe(1);
  expect(options.body.unit_code).toBe('quantity');
  expect(options.body.kcal).toBe(650);
  expect(options.body.protein_g).toBe(0);
  expect(options.body.carbs_g).toBe(0);
  expect(options.body.fat_g).toBe(0);
  expect(options.body.meal_type).toBe('other');
});

test('Express update and delete use CSRF and ignore caller-supplied user IDs', async () => {
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: { id: 'entry-id', qty: 3 } }, error: null })
    .mockResolvedValueOnce({ payload: null, error: null });

  await updateMealLog('entry-id', payload({ user_id: 'wrong-user', qty: 3 }));
  await deleteMealLog('entry-id', 'wrong-user');
  expect(mockApiRequest.mock.calls[0]).toEqual([
    '/meal-logs/entries/entry-id',
    expect.objectContaining({ method: 'PUT', csrf: true }),
  ]);
  expect(mockApiRequest.mock.calls[0][1].body.user_id).toBeUndefined();
  expect(mockApiRequest.mock.calls[1]).toEqual([
    '/meal-logs/entries/entry-id',
    expect.objectContaining({ method: 'DELETE', csrf: true }),
  ]);
});

test('summary helpers expose authoritative daily totals and day deletion', async () => {
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: [{ date: '2026-03-08', total_kcal: 650 }] }, error: null })
    .mockResolvedValueOnce({ payload: null, error: null });

  await expect(getMealLogDailyTotals()).resolves.toEqual([{ date: '2026-03-08', total_kcal: 650 }]);
  await deleteMealLogDay({ date: '2026-03-08' });
  expect(mockApiRequest.mock.calls.map((call) => call[0])).toEqual([
    '/meal-logs/summary',
    '/meal-logs/day/2026-03-08',
  ]);
  expect(mockApiRequest.mock.calls[1][1]).toEqual({ method: 'DELETE', csrf: true });
});
