const mockApiRequest = jest.fn();
const mockGetCurrentUserId = jest.fn(async () => 'session-user');
const mockGetStoredUserId = jest.fn(() => 'session-user');
jest.mock('./authClient', () => ({
  getCurrentUserId: (...args) => mockGetCurrentUserId(...args),
  getStoredUserId: (...args) => mockGetStoredUserId(...args),
}));
jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));

import {
  createCatalogItem,
  deleteCatalogItem,
  getCachedCatalogItems,
  listCatalogItems,
  processPendingCatalogSyncQueue,
  searchCatalogItems,
  updateCatalogItem,
} from './catalogClient';

function input(overrides = {}) {
  return {
    title: 'Oatmeal',
    item_type: 'meal',
    kcal_per_100g: 120,
    protein_g_per_100g: 4,
    carbs_g_per_100g: 21,
    fat_g_per_100g: 2,
    unit_conversions: {},
    food_id: null,
    ...overrides,
  };
}

function serverItem(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'session-user',
    title: 'Oatmeal',
    type: 'meal',
    item_type: 'meal',
    created_at: '2026-07-22T12:00:00.000Z',
    updated_at: '2026-07-22T12:00:00.000Z',
    kcal_per_100g: 120,
    protein_g_per_100g: 4,
    carbs_g_per_100g: 21,
    fat_g_per_100g: 2,
    unit_conversions: {},
    food_id: null,
    is_shared: false,
    ...overrides,
  };
}

beforeEach(() => {
  let uuidCounter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: jest.fn(() => {
        uuidCounter += 1;
        return `aaaaaaaa-aaaa-4aaa-8aaa-${uuidCounter.toString(16).padStart(12, '0')}`;
      }),
    },
  });
  localStorage.clear();
  mockApiRequest.mockReset();
  mockGetCurrentUserId.mockReset();
  mockGetCurrentUserId.mockResolvedValue('session-user');
  mockGetStoredUserId.mockReset();
  mockGetStoredUserId.mockReturnValue('session-user');
});

test('Express list and search retain array responses, normalized fields, and omit owner parameters', async () => {
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: [serverItem()] }, error: null })
    .mockResolvedValueOnce({
      payload: { data: [serverItem({ id: 'seed-broccoli', user_id: '__shared_catalog__', title: 'Broccoli', type: 'ingredient', item_type: 'ingredient', is_shared: true })] },
      error: null,
    });

  const listed = await listCatalogItems('meal');
  expect(listed).toEqual([expect.objectContaining({ title: 'Oatmeal', type: 'meal', item_type: 'meal' })]);
  expect(mockApiRequest.mock.calls[0][0]).toBe('/catalog/items?item_type=meal&limit=200');
  expect(mockApiRequest.mock.calls[0][0]).not.toContain('user_id');

  const searched = await searchCatalogItems('ingredient', 'broc');
  expect(searched[0]).toEqual(expect.objectContaining({ id: 'seed-broccoli', is_shared: true }));
  expect(mockApiRequest.mock.calls[1][0]).toContain('query=broc');
});

test('Express optimistic create keeps its public shape and safely maps a temporary ID after sync', async () => {
  let resolveSync;
  mockApiRequest.mockReturnValueOnce(new Promise((resolve) => { resolveSync = resolve; }));

  const optimistic = await createCatalogItem(input());
  expect(optimistic.id).toMatch(/^local-/);
  expect(optimistic.type).toBe('meal');
  expect(getCachedCatalogItems('meal')).toEqual([
    expect.objectContaining({ id: optimistic.id, title: 'Oatmeal' }),
  ]);
  const queuedBefore = JSON.parse(localStorage.getItem('pending_catalog_sync_v1'));
  expect(queuedBefore).toHaveLength(1);
  expect(queuedBefore[0].operationId).toMatch(/^[0-9a-f-]{36}$/i);

  resolveSync({
    payload: {
      data: {
        operations: [{
          status: 'completed', operationId: queuedBefore[0].operationId, kind: 'create',
          tempId: optimistic.id, itemId: serverItem().id, item: serverItem(),
        }],
      },
    },
    error: null,
  });
  await processPendingCatalogSyncQueue();

  expect(JSON.parse(localStorage.getItem('pending_catalog_sync_v1'))).toEqual([]);
  expect(getCachedCatalogItems('meal')).toEqual([
    expect.objectContaining({ id: serverItem().id, title: 'Oatmeal' }),
  ]);
  expect(mockApiRequest).toHaveBeenCalledWith('/catalog/sync', expect.objectContaining({
    method: 'POST', csrf: true,
  }));
  expect(mockApiRequest.mock.calls[0][1].body.operations[0].userId).toBeUndefined();
});

test('uncertain and permanently invalid sync results remain queued with stable operation IDs', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockApiRequest
    .mockResolvedValueOnce({ payload: null, error: { message: 'Application service is unavailable.' } })
    .mockResolvedValueOnce({
      payload: {
        data: {
          operations: [{
            status: 'permanently_invalid', kind: 'create', error: 'Conflicting change.', errorCode: 'conflict',
          }],
        },
      },
      error: null,
    });

  await createCatalogItem(input({ title: 'Conflict' }));
  await processPendingCatalogSyncQueue();
  const afterUncertain = JSON.parse(localStorage.getItem('pending_catalog_sync_v1'));
  expect(afterUncertain).toHaveLength(1);
  const operationId = afterUncertain[0].operationId;

  await processPendingCatalogSyncQueue();
  const afterPermanent = JSON.parse(localStorage.getItem('pending_catalog_sync_v1'));
  expect(afterPermanent).toHaveLength(1);
  expect(afterPermanent[0]).toEqual(expect.objectContaining({
    operationId, status: 'permanently_invalid', errorCode: 'conflict',
  }));
  expect(mockApiRequest.mock.calls[1][1].body.operations[0].operationId).toBe(operationId);
  console.warn.mockRestore();
});

test('Express queued updates and deletes preserve optimistic behavior and synchronize without owner fields', async () => {
  const original = serverItem();
  const changed = serverItem({ title: 'Updated Oatmeal', updated_at: '2026-07-22T12:05:00.000Z' });
  mockApiRequest
    .mockResolvedValueOnce({ payload: { data: [original] }, error: null })
    .mockImplementationOnce(async (path, options) => ({
      payload: {
        data: {
          operations: [{
            status: 'completed', operationId: options.body.operations[0].operationId,
            kind: 'update', itemId: original.id, item: changed,
          }],
        },
      },
      error: null,
    }))
    .mockImplementationOnce(async (path, options) => ({
      payload: {
        data: {
          operations: [{
            status: 'completed', operationId: options.body.operations[0].operationId,
            kind: 'delete', itemId: original.id, item: changed,
          }],
        },
      },
      error: null,
    }));

  await listCatalogItems('meal');
  const optimisticUpdate = await updateCatalogItem(original.id, input({ title: 'Updated Oatmeal' }));
  expect(optimisticUpdate.title).toBe('Updated Oatmeal');
  await processPendingCatalogSyncQueue();
  const updateRequest = mockApiRequest.mock.calls[1][1].body.operations[0];
  expect(updateRequest).toEqual(expect.objectContaining({ kind: 'update', itemId: original.id }));
  expect(updateRequest.input.base_updated_at).toBe(original.updated_at);
  expect(updateRequest.userId).toBeUndefined();
  expect(getCachedCatalogItems('meal')[0].title).toBe('Updated Oatmeal');

  await deleteCatalogItem(original.id);
  expect(getCachedCatalogItems('meal')).toEqual([]);
  await processPendingCatalogSyncQueue();
  const deleteRequest = mockApiRequest.mock.calls[2][1].body.operations[0];
  expect(deleteRequest).toEqual(expect.objectContaining({ kind: 'delete', itemId: original.id }));
  expect(deleteRequest.userId).toBeUndefined();
  expect(JSON.parse(localStorage.getItem('pending_catalog_sync_v1'))).toEqual([]);
});
