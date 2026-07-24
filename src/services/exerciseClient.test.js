const mockApiRequest = jest.fn();
jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));

import {
  createExerciseDefinition,
  createExerciseLog,
  formatLocalDate,
  listExerciseDefinitions,
  listExerciseLogs,
  normalizeExerciseLog,
  syncLocalExerciseState,
} from './exerciseClient';

beforeEach(() => {
  localStorage.clear();
  mockApiRequest.mockReset();
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') },
  });
});

test('Express definitions and logs preserve the context-normalized shapes', async () => {
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: [{ id: 'walk', name: 'Walking', is_shared: true }] }, error: null })
    .mockResolvedValueOnce({ payload: { data: [{
      id: 'local-log', serverId: '11111111-1111-4111-8111-111111111111',
      user_id: 'session-user', definition_id: 'walk', duration_minutes: 30,
      occurred_at: '2026-03-08T06:30:00.000Z', log_date: '2026-03-08',
    }] }, error: null });
  await expect(listExerciseDefinitions('ignored')).resolves.toEqual([
    expect.objectContaining({ id: 'walk', name: 'Walking', isShared: true }),
  ]);
  await expect(listExerciseLogs('ignored')).resolves.toEqual([
    expect.objectContaining({
      id: 'local-log', serverId: '11111111-1111-4111-8111-111111111111',
      userId: 'session-user', typeId: 'walk', minutes: 30,
      timestampISO: '2026-03-08T06:30:00.000Z', logDate: '2026-03-08',
    }),
  ]);
});

test('Express writes use CSRF, session ownership, and explicit local-date metadata', async () => {
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: { id: 'rowing', name: 'Rowing' } }, error: null })
    .mockResolvedValueOnce({ payload: { data: {
      id: 'local-id', serverId: '22222222-2222-4222-8222-222222222222',
      definition_id: 'rowing', duration_minutes: 30, occurred_at: '2026-03-08T06:30:00.000Z',
      log_date: '2026-03-08',
    } }, error: null });
  await createExerciseDefinition('client-owner', { id: 'rowing', name: 'Rowing' });
  expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/exercises', {
    method: 'POST', csrf: true, body: { id: 'rowing', name: 'Rowing' },
  });
  await createExerciseLog('client-owner', {
    id: 'local-id', typeId: 'rowing', minutes: 30, timestampISO: '2026-03-08T06:30:00.000Z',
  });
  const logCall = mockApiRequest.mock.calls[1];
  expect(logCall[0]).toBe('/exercise-logs');
  expect(logCall[1]).toMatchObject({ method: 'POST', csrf: true });
  expect(logCall[1].body).toMatchObject({
    definition_id: 'rowing', duration_minutes: 30,
    occurred_at: '2026-03-08T06:30:00.000Z', source_record_id: 'local-id',
  });
  expect(logCall[1].body).not.toHaveProperty('user_id');
  expect(logCall[1].body.log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Number.isInteger(logCall[1].body.timezone_offset_minutes)).toBe(true);
});


test('local synchronization retries with one operation and never removes browser state', async () => {
  const state = { userId: 'session-user', exerciseTypes: [], logs: [{ id: 'local-1' }] };
  localStorage.setItem('exercise_page_state_v3', JSON.stringify(state));
  mockApiRequest.mockResolvedValueOnce({ payload: null, error: { message: 'offline' } });
  const input = {
    definitions: [{ id: 'rowing', name: 'Rowing' }],
    logs: [{ id: 'local-1', typeId: 'rowing', minutes: 20, timestampISO: '2026-01-01T12:00:00.000Z' }],
  };
  await expect(syncLocalExerciseState('session-user', input)).rejects.toThrow('offline');
  expect(JSON.parse(localStorage.getItem('exercise_page_state_v3'))).toEqual(state);
  const operationId = mockApiRequest.mock.calls[0][1].body.operationId;
  mockApiRequest.mockResolvedValueOnce({ payload: { data: { committed: true, localDataRetained: true } }, error: null });
  await syncLocalExerciseState('session-user', input);
  expect(mockApiRequest.mock.calls[1][1].body.operationId).toBe(operationId);
  expect(JSON.parse(localStorage.getItem('exercise_page_state_v3'))).toEqual(state);
});

test('date formatting and normalized log dates do not reinterpret date-only values', () => {
  const localDate = new Date(2026, 2, 8, 1, 30, 0);
  expect(formatLocalDate(localDate)).toBe('2026-03-08');
  expect(normalizeExerciseLog({
    id: 'log', definition_id: 'walk', duration_minutes: 15,
    occurred_at: localDate.toISOString(), log_date: '2026-03-08',
  }).logDate).toBe('2026-03-08');
});
