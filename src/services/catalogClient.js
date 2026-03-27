import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config/api';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId, getStoredUserId } from './authClient';

const LOCAL_CATALOG_STORAGE_KEY = 'local_catalog_items_v1';
const PENDING_CATALOG_SYNC_KEY = 'pending_catalog_sync_v1';
const catalogCache = new Map();
const LOCAL_BACKEND_RETRY_MS = 30000;
let localBackendUnavailableUntil = 0;
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

function createLocalBackendUnreachableError() {
  const error = new Error(
    `Local backend unreachable at ${API_BASE_URL}. Check REACT_APP_API_BASE_URL in .env.local, then start the Rust server and try again.`
  );
  error.code = 'LOCAL_BACKEND_UNREACHABLE';
  return error;
}

const loggedLocalReadFallbacks = new Set();

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingCatalogSyncQueue(queue) {
  localStorage.setItem(PENDING_CATALOG_SYNC_KEY, JSON.stringify(queue));
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

function upsertPendingCatalogCreateOperation(userId, tempId, input) {
  updatePendingCatalogSyncQueue((queue) => {
    const nextOperation = {
      kind: 'create',
      userId,
      tempId,
      input,
    };
    const existingIndex = queue.findIndex((entry) => entry.kind === 'create' && entry.userId === userId && entry.tempId === tempId);
    if (existingIndex === -1) {
      return [...queue, nextOperation];
    }

    const nextQueue = [...queue];
    nextQueue[existingIndex] = nextOperation;
    return nextQueue;
  });
}

function upsertPendingCatalogUpdateOperation(userId, itemId, input) {
  updatePendingCatalogSyncQueue((queue) => {
    const createIndex = queue.findIndex((entry) => entry.kind === 'create' && entry.userId === userId && entry.tempId === itemId);
    if (createIndex !== -1) {
      const nextQueue = [...queue];
      nextQueue[createIndex] = {
        ...nextQueue[createIndex],
        input,
      };
      return nextQueue;
    }

    const nextOperation = {
      kind: 'update',
      userId,
      itemId,
      input,
    };
    const existingIndex = queue.findIndex((entry) => entry.kind === 'update' && entry.userId === userId && entry.itemId === itemId);
    if (existingIndex === -1) {
      return [...queue, nextOperation];
    }

    const nextQueue = [...queue];
    nextQueue[existingIndex] = nextOperation;
    return nextQueue;
  });
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
  const item = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    user_id: userId,
    title: input.title,
    item_type: input.item_type,
    created_at: input.created_at || new Date().toISOString(),
    kcal_per_100g: input.kcal_per_100g,
    protein_g_per_100g: input.protein_g_per_100g,
    carbs_g_per_100g: input.carbs_g_per_100g,
    fat_g_per_100g: input.fat_g_per_100g,
    unit_conversions: input.unit_conversions,
    food_id: input.food_id ?? null,
  };

  const items = readLocalCatalogItems();
  items.unshift(item);
  writeLocalCatalogItems(items);
  setCachedCatalogItems(userId, input.item_type, listLocalCatalogItems(userId, input.item_type));
  return item;
}

function updateLocalCatalogItem(userId, itemId, input) {
  const items = readLocalCatalogItems();
  const index = items.findIndex((item) => item.user_id === userId && item.id === itemId);

  if (index === -1) {
    throw new Error('Ingredient not found.');
  }

  const nextItem = {
    ...items[index],
    title: input.title,
    item_type: input.item_type,
    kcal_per_100g: input.kcal_per_100g,
    protein_g_per_100g: input.protein_g_per_100g,
    carbs_g_per_100g: input.carbs_g_per_100g,
    fat_g_per_100g: input.fat_g_per_100g,
    unit_conversions: input.unit_conversions,
    food_id: input.food_id ?? items[index].food_id ?? null,
  };

  items[index] = nextItem;
  writeLocalCatalogItems(items);
  setCachedCatalogItems(userId, nextItem.item_type, listLocalCatalogItems(userId, nextItem.item_type));
  return nextItem;
}

function deleteLocalCatalogItem(userId, itemId) {
  const items = readLocalCatalogItems();
  const nextItems = items.filter((item) => !(item.user_id === userId && item.id === itemId));

  if (nextItems.length === items.length) {
    throw new Error('Item not found.');
  }

  writeLocalCatalogItems(nextItems);
  catalogCache.clear();
}

function listLocalCatalogItems(userId, itemType) {
  return readLocalCatalogItems()
    .filter((item) => item.user_id === userId && item.item_type === itemType)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function searchLocalCatalogItems(userId, itemType, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return listLocalCatalogItems(userId, itemType)
    .filter((item) => item.title?.toLowerCase().includes(needle))
    .slice(0, 20);
}

async function postLocal(path, body) {
  if (Date.now() < localBackendUnavailableUntil) {
    throw createLocalBackendUnreachableError();
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    localBackendUnavailableUntil = Date.now() + LOCAL_BACKEND_RETRY_MS;
    throw createLocalBackendUnreachableError();
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Local catalog request failed with status ${response.status}.`);
  }

  return payload;
}

function logLocalReadFallback(path) {
  if (loggedLocalReadFallbacks.has(path)) {
    return;
  }
  loggedLocalReadFallbacks.add(path);
  console.warn(
    `[catalogClient] Falling back to local browser storage because the local backend is unavailable for ${path}.`
  );
}

function getLocalCatalogUserId() {
  return getStoredUserId() || 'anonymous';
}

async function syncPendingCatalogOperation(operation) {
  if (operation.kind === 'create') {
    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: operation.userId,
        title: operation.input.title,
        type: operation.input.item_type,
        created_at: operation.input.created_at,
        kcal_per_100g: operation.input.kcal_per_100g,
        protein_g_per_100g: operation.input.protein_g_per_100g,
        carbs_g_per_100g: operation.input.carbs_g_per_100g,
        fat_g_per_100g: operation.input.fat_g_per_100g,
        unit_conversions: operation.input.unit_conversions,
        food_id: operation.input.food_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    const normalized = normalizeCatalogItem(data);
    replaceLocalCatalogItemSnapshot(operation.tempId, normalized);
    replaceCachedCatalogItem(operation.userId, normalized.type, operation.tempId, normalized);
    removePendingCatalogOperation((entry) => entry.kind === 'create' && entry.userId === operation.userId && entry.tempId === operation.tempId);
    return;
  }

  const { data, error } = await supabase
    .from('meals')
    .update({
      title: operation.input.title,
      type: operation.input.item_type,
      kcal_per_100g: operation.input.kcal_per_100g,
      protein_g_per_100g: operation.input.protein_g_per_100g,
      carbs_g_per_100g: operation.input.carbs_g_per_100g,
      fat_g_per_100g: operation.input.fat_g_per_100g,
      unit_conversions: operation.input.unit_conversions,
      food_id: operation.input.food_id ?? null,
    })
    .eq('id', operation.itemId)
    .eq('user_id', operation.userId)
    .select()
    .single();

  if (error) throw error;
  const normalized = normalizeCatalogItem(data);
  upsertLocalCatalogItemSnapshot(normalized);
  replaceCachedCatalogItem(operation.userId, normalized.type, operation.itemId, normalized);
  removePendingCatalogOperation((entry) => entry.kind === 'update' && entry.userId === operation.userId && entry.itemId === operation.itemId);
}

export function processPendingCatalogSyncQueue() {
  if (isLocalAuth()) {
    return Promise.resolve();
  }

  if (pendingCatalogSyncPromise) {
    return pendingCatalogSyncPromise;
  }

  pendingCatalogSyncPromise = (async () => {
    while (true) {
      const [nextOperation] = readPendingCatalogSyncQueue();
      if (!nextOperation) {
        return;
      }

      try {
        await syncPendingCatalogOperation(nextOperation);
      } catch (error) {
        console.warn('Failed to sync pending catalog operation', error);
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

  if (isLocalAuth()) {
    try {
      return await postLocal('/catalog/items', {
        user_id: userId,
        ...input,
      });
    } catch (error) {
      if (error?.code === 'LOCAL_BACKEND_UNREACHABLE') {
        return createLocalCatalogItem(userId, input);
      }
      throw error;
    }
  }

  const optimisticItem = normalizeCatalogItem(createLocalCatalogItem(userId, {
    ...input,
    created_at: input.created_at || new Date().toISOString(),
  }));
  patchCachedCatalogItem(userId, optimisticItem.type, optimisticItem);
  upsertPendingCatalogCreateOperation(userId, optimisticItem.id, {
    ...input,
    created_at: optimisticItem.created_at,
  });
  void processPendingCatalogSyncQueue();
  return optimisticItem;
}

export async function updateCatalogItem(itemId, input) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');

  if (isLocalAuth()) {
    return normalizeCatalogItem(updateLocalCatalogItem(userId, itemId, input));
  }

  const previousItem = readLocalCatalogItems().find((item) => item.id === itemId) || null;
  const optimisticItem = normalizeCatalogItem({
    ...(previousItem || {}),
    id: itemId,
    user_id: userId,
    title: input.title,
    item_type: input.item_type,
    type: input.item_type,
    created_at: previousItem?.created_at || new Date().toISOString(),
    kcal_per_100g: input.kcal_per_100g,
    protein_g_per_100g: input.protein_g_per_100g,
    carbs_g_per_100g: input.carbs_g_per_100g,
    fat_g_per_100g: input.fat_g_per_100g,
    unit_conversions: input.unit_conversions,
    food_id: input.food_id ?? null,
  });
  upsertLocalCatalogItemSnapshot(optimisticItem);
  patchCachedCatalogItem(userId, optimisticItem.type, optimisticItem);
  upsertPendingCatalogUpdateOperation(userId, itemId, input);
  void processPendingCatalogSyncQueue();
  return optimisticItem;
}

export async function deleteCatalogItem(itemId) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');

  if (isLocalAuth()) {
    deleteLocalCatalogItem(userId, itemId);
    return;
  }

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) throw error;
  removeCachedCatalogItem(userId, itemId);
}

export async function listCatalogItems(itemType) {
  if (isLocalAuth()) {
    const userId = getLocalCatalogUserId();
    try {
      const data = await postLocal('/catalog/items/list', {
        user_id: userId,
        item_type: itemType,
      });
      const normalized = data.map(normalizeCatalogItem);
      setCachedCatalogItems(userId, itemType, normalized);
      return normalized;
    } catch (error) {
      if (error?.code === 'LOCAL_BACKEND_UNREACHABLE') {
        logLocalReadFallback('/catalog/items/list');
        const normalized = listLocalCatalogItems(userId, itemType).map(normalizeCatalogItem);
        setCachedCatalogItems(userId, itemType, normalized);
        return normalized;
      }
      throw error;
    }
  }

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  const { data, error } = await supabase
    .from('meals')
    .select('id, user_id, title, type, created_at, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id')
    .eq('user_id', userId)
    .eq('type', itemType)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  const normalized = mergeCatalogItems(
    getPendingCatalogSnapshots(userId, itemType),
    (data || []).map(normalizeCatalogItem)
  );
  setCachedCatalogItems(userId, itemType, normalized);
  void processPendingCatalogSyncQueue();
  return normalized;
}

export async function searchCatalogItems(itemType, query) {
  if (!query?.trim()) return [];

  if (isLocalAuth()) {
    const userId = getLocalCatalogUserId();
    try {
      const data = await postLocal('/catalog/items/search', {
        user_id: userId,
        item_type: itemType,
        query,
      });
      return data.map(normalizeCatalogItem);
    } catch (error) {
      if (error?.code === 'LOCAL_BACKEND_UNREACHABLE') {
        logLocalReadFallback('/catalog/items/search');
        return searchLocalCatalogItems(userId, itemType, query).map(normalizeCatalogItem);
      }
      throw error;
    }
  }

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  const { data, error } = await supabase
    .from('meals')
    .select('id, user_id, title, type, created_at, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id')
    .eq('user_id', userId)
    .eq('type', itemType)
    .ilike('title', `%${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  void processPendingCatalogSyncQueue();
  return mergeCatalogItems(
    getPendingCatalogSnapshots(userId, itemType, query),
    (data || []).map(normalizeCatalogItem)
  );
}

export function getCachedCatalogItems(itemType, userId = getStoredUserId()) {
  if (!userId) return [];

  const cached = catalogCache.get(getCatalogCacheKey(userId, itemType));
  if (cached) {
    return cached;
  }

  if (isLocalAuth()) {
    const normalized = listLocalCatalogItems(userId, itemType).map(normalizeCatalogItem);
    setCachedCatalogItems(userId, itemType, normalized);
    return normalized;
  }

  return getPendingCatalogSnapshots(userId, itemType);
}
