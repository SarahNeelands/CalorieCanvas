import { getCurrentUserId, getStoredUserId } from './authClient';
import { apiRequest } from './apiClient';

const LOCAL_CATALOG_STORAGE_KEY = 'local_catalog_items_v1';
const PENDING_CATALOG_SYNC_KEY = 'pending_catalog_sync_v1';
const catalogCache = new Map();
let pendingCatalogSyncPromise = null;

function getCatalogCacheKey(userId, itemType) {
  return `${userId || 'anonymous'}:${itemType}`;
}

function setCachedCatalogItems(userId, itemType, items) {
  catalogCache.set(getCatalogCacheKey(userId, itemType), items.map(normalizeCatalogItem));
}

function removeCachedCatalogItem(userId, itemId) {
  for (const [key, items] of catalogCache.entries()) {
    if (!key.startsWith(`${userId}:`)) continue;
    catalogCache.set(
      key,
      items.filter((item) => item.id !== itemId)
    );
  }
}

function normalizeCatalogItem(item) {
  return {
    ...item,
    type: item.type || item.item_type,
  };
}

function stripCatalogPhotoData(unitConversions) {
  if (!unitConversions || typeof unitConversions !== 'object') {
    return unitConversions ?? null;
  }

  const nextUnitConversions = { ...unitConversions };
  delete nextUnitConversions.photo_data_url;
  return nextUnitConversions;
}

function readLocalCatalogItems() {
  try {
    const raw = localStorage.getItem(LOCAL_CATALOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCatalogItems(items) {
  localStorage.setItem(LOCAL_CATALOG_STORAGE_KEY, JSON.stringify(items));
}

function readPendingCatalogSyncQueue() {
  try {
    const raw = localStorage.getItem(PENDING_CATALOG_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    let changed = false;
    const queue = parsed.map((operation) => {
      if (operation?.operationId) return operation;
      changed = true;
      return { ...operation, operationId: createSecureUuid(), status: 'pending' };
    });
    if (changed) writePendingCatalogSyncQueue(queue);
    return queue;
  } catch {
    return [];
  }
}

function writePendingCatalogSyncQueue(queue) {
  localStorage.setItem(PENDING_CATALOG_SYNC_KEY, JSON.stringify(queue));
}

function createSecureUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  if (!window.crypto?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable.');
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function updatePendingCatalogSyncQueue(updater) {
  const nextQueue = updater(readPendingCatalogSyncQueue());
  writePendingCatalogSyncQueue(nextQueue);
  return nextQueue;
}

function upsertLocalCatalogItemSnapshot(item) {
  const items = readLocalCatalogItems();
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    items.unshift(item);
  } else {
    items[index] = item;
  }
  writeLocalCatalogItems(items);
}

function replaceLocalCatalogItemSnapshot(previousId, nextItem) {
  const items = readLocalCatalogItems();
  const nextItems = items
    .filter((entry) => entry.id !== previousId)
    .filter((entry, index, source) => source.findIndex((candidate) => candidate.id === entry.id) === index);
  nextItems.unshift(nextItem);
  writeLocalCatalogItems(nextItems);
}

function removeLocalCatalogItemSnapshot(itemId) {
  writeLocalCatalogItems(readLocalCatalogItems().filter((item) => item.id !== itemId));
}

function patchCachedCatalogItem(userId, itemType, item) {
  const existing = catalogCache.get(getCatalogCacheKey(userId, itemType)) || [];
  const nextItems = [item, ...existing.filter((entry) => entry.id !== item.id)];
  setCachedCatalogItems(userId, itemType, nextItems);
}

function replaceCachedCatalogItem(userId, itemType, previousId, item) {
  const existing = catalogCache.get(getCatalogCacheKey(userId, itemType)) || [];
  const nextItems = [item, ...existing.filter((entry) => entry.id !== previousId && entry.id !== item.id)];
  setCachedCatalogItems(userId, itemType, nextItems);
}

function removePendingCatalogOperation(predicate) {
  updatePendingCatalogSyncQueue((queue) => queue.filter((entry) => !predicate(entry)));
}

function getPendingCatalogSnapshots(userId, itemType, query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  const pendingIds = new Set(
    readPendingCatalogSyncQueue()
      .filter((entry) => entry.userId === userId && entry.input?.item_type === itemType)
      .map((entry) => (entry.kind === 'create' ? entry.tempId : entry.itemId))
  );

  return readLocalCatalogItems()
    .filter((item) => item.user_id === userId && item.item_type === itemType && pendingIds.has(item.id))
    .filter((item) => !normalizedQuery || item.title?.toLowerCase().includes(normalizedQuery))
    .map(normalizeCatalogItem);
}

function mergeCatalogItems(primaryItems, secondaryItems) {
  return [...primaryItems, ...secondaryItems].filter(
    (item, index, source) => source.findIndex((candidate) => candidate.id === item.id) === index
  );
}

function createLocalCatalogItem(userId, input) {
  const item = buildCatalogSnapshot(userId, input, {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const items = readLocalCatalogItems();
  items.unshift(item);
  writeLocalCatalogItems(items);
  setCachedCatalogItems(userId, input.item_type, listLocalCatalogItems(userId, input.item_type));
  return item;
}

function buildCatalogSnapshot(userId, input, options = {}) {
  return {
    id: options.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    user_id: userId,
    title: input.title,
    item_type: input.item_type,
    type: input.item_type,
    created_at: input.created_at || new Date().toISOString(),
    kcal_per_100g: input.kcal_per_100g,
    protein_g_per_100g: input.protein_g_per_100g,
    carbs_g_per_100g: input.carbs_g_per_100g,
    fat_g_per_100g: input.fat_g_per_100g,
    unit_conversions: stripCatalogPhotoData(input.unit_conversions),
    food_id: input.food_id ?? null,
  };
}

function findCachedCatalogItem(userId, itemId) {
  for (const [key, items] of catalogCache.entries()) {
    if (!key.startsWith(`${userId}:`)) continue;
    const match = items.find((item) => item.id === itemId);
    if (match) {
      return match;
    }
  }
  return null;
}

function saveLocalCatalogSnapshot(item) {
  const { type, ...snapshot } = item;
  void type;
  upsertLocalCatalogItemSnapshot(snapshot);
}

function queuePendingCatalogOperation(operation) {
  const queuedOperation = {
    operationId: operation.operationId || createSecureUuid(),
    status: operation.status || 'pending',
    ...operation,
  };
  updatePendingCatalogSyncQueue((queue) => {
    const nextQueue = queue.filter((entry) => {
      if (queuedOperation.kind === 'create') {
        return !(entry.kind === 'create' && entry.userId === queuedOperation.userId && entry.tempId === queuedOperation.tempId);
      }

      if (queuedOperation.kind === 'update') {
        if (entry.kind === 'create' && entry.userId === queuedOperation.userId && entry.tempId === queuedOperation.itemId) {
          return false;
        }

        return !(entry.kind === 'update' && entry.userId === queuedOperation.userId && entry.itemId === queuedOperation.itemId);
      }

      return true;
    });

    nextQueue.push(queuedOperation);
    return nextQueue;
  });
}

function listLocalCatalogItems(userId, itemType) {
  return readLocalCatalogItems()
    .filter((item) => item.user_id === userId && item.item_type === itemType)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function syncPendingCatalogOperation(operation) {
  const serverOperation = {
      operationId: operation.operationId,
      kind: operation.kind,
      ...(operation.itemId ? { itemId: operation.itemId } : {}),
      ...(operation.tempId ? { tempId: operation.tempId } : {}),
      ...(operation.input ? {
        input: {
          ...operation.input,
          ...(operation.baseUpdatedAt ? { base_updated_at: operation.baseUpdatedAt } : {}),
        },
      } : {}),
    };
    const { payload, error } = await apiRequest('/catalog/sync', {
      method: 'POST',
      csrf: true,
      body: { operations: [serverOperation] },
    });
    if (error) throw new Error(error.message);
    const result = payload?.data?.operations?.[0];
    if (!result) throw new Error('Catalog synchronization returned an invalid response.');
    if (result.status === 'retryable') {
      updatePendingCatalogSyncQueue((queue) => queue.map((entry) => (
        entry.operationId === operation.operationId
          ? { ...entry, status: 'retryable', lastError: result.error }
          : entry
      )));
      throw new Error(result.error || 'Catalog synchronization will be retried.');
    }
    if (result.status === 'permanently_invalid') {
      updatePendingCatalogSyncQueue((queue) => queue.map((entry) => (
        entry.operationId === operation.operationId
          ? { ...entry, status: 'permanently_invalid', lastError: result.error, errorCode: result.errorCode }
          : entry
      )));
      return;
    }

    const normalized = result.item ? normalizeCatalogItem(result.item) : null;
    if (operation.kind === 'create' && normalized) {
      const operationWasCancelled = !readPendingCatalogSyncQueue().some(
        (entry) => entry.operationId === operation.operationId
      );
      if (operationWasCancelled) {
        queuePendingCatalogOperation({
          kind: 'delete', userId: operation.userId, itemId: normalized.id,
        });
        removeLocalCatalogItemSnapshot(operation.tempId);
        removeCachedCatalogItem(operation.userId, operation.tempId);
        return;
      }
      replaceLocalCatalogItemSnapshot(operation.tempId, normalized);
      replaceCachedCatalogItem(operation.userId, normalized.type, operation.tempId, normalized);
    } else if (operation.kind === 'update' && normalized) {
      upsertLocalCatalogItemSnapshot(normalized);
      replaceCachedCatalogItem(operation.userId, normalized.type, operation.itemId, normalized);
    } else if (operation.kind === 'delete' || operation.kind === 'archive') {
      removeLocalCatalogItemSnapshot(operation.itemId);
      removeCachedCatalogItem(operation.userId, operation.itemId);
    }
  removePendingCatalogOperation((entry) => entry.operationId === operation.operationId);
}

export function processPendingCatalogSyncQueue() {
  if (pendingCatalogSyncPromise) {
    return pendingCatalogSyncPromise;
  }

  pendingCatalogSyncPromise = (async () => {
    while (true) {
      const nextOperation = readPendingCatalogSyncQueue().find(
        (operation) => operation.status !== 'permanently_invalid'
      );
      if (!nextOperation) {
        return;
      }

      try {
        await syncPendingCatalogOperation(nextOperation);
      } catch (error) {
        updatePendingCatalogSyncQueue((queue) => queue.map((entry) => (
          entry.operationId === nextOperation.operationId
            ? { ...entry, status: 'retryable', lastError: 'Catalog synchronization will be retried.' }
            : entry
        )));
        console.warn('Failed to sync pending catalog operation.');
        return;
      }
    }
  })();

  return pendingCatalogSyncPromise.finally(() => {
    pendingCatalogSyncPromise = null;
  });
}

export async function createCatalogItem(input) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  const sanitizedInput = {
    ...input,
    unit_conversions: stripCatalogPhotoData(input.unit_conversions),
  };

  const createdInput = {
    ...sanitizedInput,
    created_at: sanitizedInput.created_at || new Date().toISOString(),
  };
  const tempItem = normalizeCatalogItem(createLocalCatalogItem(userId, createdInput));
  queuePendingCatalogOperation({
    kind: 'create',
    userId,
    tempId: tempItem.id,
    input: createdInput,
  });
  patchCachedCatalogItem(userId, tempItem.type, tempItem);
  void processPendingCatalogSyncQueue();
  return tempItem;
}

export async function updateCatalogItem(itemId, input) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');
  const sanitizedInput = {
    ...input,
    unit_conversions: stripCatalogPhotoData(input.unit_conversions),
  };

  const existingItem =
    readLocalCatalogItems().find((item) => item.user_id === userId && item.id === itemId) ||
    findCachedCatalogItem(userId, itemId);
  const updatedItem = normalizeCatalogItem(buildCatalogSnapshot(userId, sanitizedInput, {
    id: itemId,
    created_at: existingItem?.created_at,
  }));
  saveLocalCatalogSnapshot(updatedItem);
  const pendingCreate = readPendingCatalogSyncQueue().find(
    (entry) => entry.kind === 'create' && entry.userId === userId && entry.tempId === itemId
  );

  if (pendingCreate) {
    queuePendingCatalogOperation({
      ...pendingCreate,
      input: {
        ...pendingCreate.input,
        ...sanitizedInput,
      },
    });
  } else {
    queuePendingCatalogOperation({
      kind: 'update',
      userId,
      itemId,
      input: sanitizedInput,
      baseUpdatedAt: existingItem?.updated_at || null,
    });
  }

  patchCachedCatalogItem(userId, updatedItem.type, updatedItem);
  void processPendingCatalogSyncQueue();
  return updatedItem;
}

export async function deleteCatalogItem(itemId) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');

  const pendingCreate = readPendingCatalogSyncQueue().find(
      (entry) => entry.kind === 'create' && entry.userId === userId && entry.tempId === itemId
    );
    if (pendingCreate) {
      removePendingCatalogOperation((entry) => entry.operationId === pendingCreate.operationId);
    } else {
      queuePendingCatalogOperation({ kind: 'delete', userId, itemId });
    }
    removeLocalCatalogItemSnapshot(itemId);
    removeCachedCatalogItem(userId, itemId);
    void processPendingCatalogSyncQueue();
  return;
}

export async function listCatalogItems(itemType) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  await processPendingCatalogSyncQueue();

  const { payload, error } = await apiRequest(
      `/catalog/items?item_type=${encodeURIComponent(itemType)}&limit=200`
    );
    if (error) throw new Error(error.message);
    const normalized = mergeCatalogItems(
      getPendingCatalogSnapshots(userId, itemType),
      (payload?.data || []).map(normalizeCatalogItem)
    );
    setCachedCatalogItems(userId, itemType, normalized);
    void processPendingCatalogSyncQueue();
  return normalized;
}

export async function searchCatalogItems(itemType, query) {
  if (!query?.trim()) return [];

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  await processPendingCatalogSyncQueue();

  const { payload, error } = await apiRequest(
      `/catalog/items?item_type=${encodeURIComponent(itemType)}&query=${encodeURIComponent(query.trim())}&limit=20`
    );
    if (error) throw new Error(error.message);
    void processPendingCatalogSyncQueue();
  return mergeCatalogItems(
      getPendingCatalogSnapshots(userId, itemType, query),
      (payload?.data || []).map(normalizeCatalogItem)
  );
}

export function getCachedCatalogItems(itemType, userId = getStoredUserId()) {
  if (!userId) return [];

  const cached = catalogCache.get(getCatalogCacheKey(userId, itemType));
  if (cached) {
    return cached;
  }

  return getPendingCatalogSnapshots(userId, itemType);
}

export async function archiveCatalogItem(itemId) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');
  queuePendingCatalogOperation({ kind: 'archive', userId, itemId });
  removeLocalCatalogItemSnapshot(itemId);
  removeCachedCatalogItem(userId, itemId);
  void processPendingCatalogSyncQueue();
}
