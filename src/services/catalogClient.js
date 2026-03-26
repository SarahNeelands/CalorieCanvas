import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config/api';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId, getStoredUserId } from './authClient';

const LOCAL_CATALOG_STORAGE_KEY = 'local_catalog_items_v1';
const catalogCache = new Map();
const LOCAL_BACKEND_RETRY_MS = 30000;
let localBackendUnavailableUntil = 0;

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

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      title: input.title,
      type: input.item_type,
      created_at: input.created_at,
      kcal_per_100g: input.kcal_per_100g,
      protein_g_per_100g: input.protein_g_per_100g,
      carbs_g_per_100g: input.carbs_g_per_100g,
      fat_g_per_100g: input.fat_g_per_100g,
      unit_conversions: input.unit_conversions,
      food_id: input.food_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  const normalized = normalizeCatalogItem(data);
  const existing = catalogCache.get(getCatalogCacheKey(userId, normalized.type)) || [];
  setCachedCatalogItems(userId, normalized.type, [normalized, ...existing.filter((item) => item.id !== normalized.id)]);
  return normalized;
}

export async function updateCatalogItem(itemId, input) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');
  if (!itemId) throw new Error('Missing item ID');

  if (isLocalAuth()) {
    return normalizeCatalogItem(updateLocalCatalogItem(userId, itemId, input));
  }

  const { data, error } = await supabase
    .from('meals')
    .update({
      title: input.title,
      type: input.item_type,
      kcal_per_100g: input.kcal_per_100g,
      protein_g_per_100g: input.protein_g_per_100g,
      carbs_g_per_100g: input.carbs_g_per_100g,
      fat_g_per_100g: input.fat_g_per_100g,
      unit_conversions: input.unit_conversions,
      food_id: input.food_id ?? null,
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  const normalized = normalizeCatalogItem(data);
  const existing = catalogCache.get(getCatalogCacheKey(userId, normalized.type)) || [];
  setCachedCatalogItems(
    userId,
    normalized.type,
    existing.map((item) => (item.id === normalized.id ? normalized : item))
  );
  return normalized;
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
  const normalized = (data || []).map(normalizeCatalogItem);
  setCachedCatalogItems(userId, itemType, normalized);
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
  return (data || []).map(normalizeCatalogItem);
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

  return [];
}
