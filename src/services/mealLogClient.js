import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId, getStoredUserId } from './authClient';
import { getCachedCatalogItems } from './catalogClient';
import { BUILT_IN_INGREDIENTS } from './builtInIngredients';
import { toMassValue } from '../utils/nutrients';
import { resolveToGrams } from '../utils/units';

const LOCAL_MEAL_LOGS_KEY = 'local_meal_logs_v1';

function readLocalMealLogs() {
  try {
    const raw = localStorage.getItem(LOCAL_MEAL_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMealLogs(entries) {
  localStorage.setItem(LOCAL_MEAL_LOGS_KEY, JSON.stringify(entries));
}

function getLocalDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function scalePer100gValue(value, grams) {
  return (Number(value || 0) * Number(grams || 0)) / 100;
}

function servingUnitToGrams(qty, unit) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return null;

  const gramsByUnit = {
    mg: 0.001,
    g: 1,
    ml: 1,
    oz: 28.3495,
    lb: 453.592,
    cup: 236.588,
    tbsp: 14.7868,
    tsp: 4.92892,
  };

  const normalizedUnit = String(unit || "g").trim().toLowerCase();
  if (!gramsByUnit[normalizedUnit]) return null;
  return numericQty * gramsByUnit[normalizedUnit];
}

function derivePer100gFromServingValue(entry, value) {
  const serving = entry?.meal?.unit_conversions?.serving_size;
  const gramsPerServing = servingUnitToGrams(serving?.qty, serving?.unit);
  if (!(gramsPerServing > 0)) return 0;
  return Number(value || 0) * (100 / gramsPerServing);
}

function getResolvedGrams(entry) {
  const directGrams = Number(entry?.grams_resolved || 0);
  if (directGrams > 0) return directGrams;

  if (entry?.meal) {
    const derivedGrams = resolveToGrams({
      unit: entry.unit_code,
      qty: entry.qty,
      item: entry.meal,
    });
    if (Number(derivedGrams) > 0) {
      return Number(derivedGrams);
    }
  }

  return 0;
}

function readPer100gMacro(entry, key) {
  const macros = entry?.meal?.unit_conversions?.macros_per_100g;
  if (typeof macros?.[key] === 'number') {
    return Number(macros[key] || 0);
  }

  const servingMacros = entry?.meal?.unit_conversions?.macros;
  if (typeof servingMacros?.[key] === 'number') {
    return derivePer100gFromServingValue(entry, servingMacros[key]);
  }

  return 0;
}

function readPrimaryPer100gValue(entry, key) {
  const meal = entry?.meal;
  if (!meal) return 0;

  if (key === 'calories') return Number(meal.kcal_per_100g || 0);
  if (key === 'protein') return Number(meal.protein_g_per_100g || 0);
  if (key === 'carbs') return Number(meal.carbs_g_per_100g || 0);
  if (key === 'fat') return Number(meal.fat_g_per_100g || 0);
  return 0;
}

function readPer100gMicro(entry, key) {
  const micros = entry?.meal?.unit_conversions?.micros_per_100g;
  if (typeof micros?.[key] === 'number') {
    return Number(micros[key] || 0);
  }

  const servingMicros = entry?.meal?.unit_conversions?.micros;
  if (servingMicros?.[key]?.value !== undefined && servingMicros?.[key]?.value !== null) {
    return derivePer100gFromServingValue(
      entry,
      toMassValue(servingMicros[key].value, servingMicros[key].unit, key)
    );
  }

  return 0;
}

function buildHostedNutrientSummary(entries) {
  return entries.reduce(
    (totals, entry) => {
      const grams = getResolvedGrams(entry);
      const derivedCalories = scalePer100gValue(readPrimaryPer100gValue(entry, 'calories'), grams);
      const derivedProtein = scalePer100gValue(readPrimaryPer100gValue(entry, 'protein'), grams);
      const derivedCarbs = scalePer100gValue(readPrimaryPer100gValue(entry, 'carbs'), grams);
      const derivedFat = scalePer100gValue(readPrimaryPer100gValue(entry, 'fat'), grams);
      totals.calories += Number(entry.kcal ?? (derivedCalories || 0));
      totals.protein_g += Number(entry.protein_g ?? (derivedProtein || 0));
      totals.carbs_g += Number(entry.carbs_g ?? (derivedCarbs || 0));
      totals.fat_g += Number(entry.fat_g ?? (derivedFat || 0));
      totals.fiber_g += scalePer100gValue(readPer100gMacro(entry, 'fiber'), grams);
      totals.sugar_g += scalePer100gValue(readPer100gMacro(entry, 'sugar'), grams);
      totals.cholesterol_mg += scalePer100gValue(readPer100gMacro(entry, 'cholesterol'), grams);
      totals.sodium_mg += scalePer100gValue(readPer100gMicro(entry, 'sodium'), grams);
      totals.potassium_mg += scalePer100gValue(readPer100gMicro(entry, 'potassium'), grams);
      totals.calcium_mg += scalePer100gValue(readPer100gMicro(entry, 'calcium'), grams);
      totals.iron_mg += scalePer100gValue(readPer100gMicro(entry, 'iron'), grams);
      totals.vitamin_a_mcg += scalePer100gValue(readPer100gMicro(entry, 'vitaminA'), grams);
      totals.vitamin_c_mg += scalePer100gValue(readPer100gMicro(entry, 'vitaminC'), grams);
      return totals;
    },
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      cholesterol_mg: 0,
      sodium_mg: 0,
      potassium_mg: 0,
      calcium_mg: 0,
      iron_mg: 0,
      vitamin_a_mcg: 0,
      vitamin_c_mg: 0,
    }
  );
}

function buildLocalNutrientSummary(entries, catalogItemsById) {
  return entries.reduce(
    (totals, entry) => {
      const meal = catalogItemsById.get(entry.meal_id) || null;
      const enrichedEntry = meal ? { ...entry, meal } : entry;
      const grams = getResolvedGrams(enrichedEntry);
      const derivedCalories = scalePer100gValue(readPrimaryPer100gValue(enrichedEntry, 'calories'), grams);
      const derivedProtein = scalePer100gValue(readPrimaryPer100gValue(enrichedEntry, 'protein'), grams);
      const derivedCarbs = scalePer100gValue(readPrimaryPer100gValue(enrichedEntry, 'carbs'), grams);
      const derivedFat = scalePer100gValue(readPrimaryPer100gValue(enrichedEntry, 'fat'), grams);

      totals.calories += Number(entry.kcal ?? (derivedCalories || 0));
      totals.protein_g += Number(entry.protein_g ?? (derivedProtein || 0));
      totals.carbs_g += Number(entry.carbs_g ?? (derivedCarbs || 0));
      totals.fat_g += Number(entry.fat_g ?? (derivedFat || 0));
      totals.fiber_g += Number(entry.fiber_g ?? (scalePer100gValue(readPer100gMacro(enrichedEntry, 'fiber'), grams) || 0));
      totals.sugar_g += Number(entry.sugar_g ?? (scalePer100gValue(readPer100gMacro(enrichedEntry, 'sugar'), grams) || 0));
      totals.cholesterol_mg += Number(entry.cholesterol_mg ?? (scalePer100gValue(readPer100gMacro(enrichedEntry, 'cholesterol'), grams) || 0));
      totals.sodium_mg += Number(entry.micros?.sodium ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'sodium'), grams) || 0));
      totals.potassium_mg += Number(entry.micros?.potassium ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'potassium'), grams) || 0));
      totals.calcium_mg += Number(entry.micros?.calcium ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'calcium'), grams) || 0));
      totals.iron_mg += Number(entry.micros?.iron ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'iron'), grams) || 0));
      totals.vitamin_a_mcg += Number(entry.micros?.vitaminA ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'vitaminA'), grams) || 0));
      totals.vitamin_c_mg += Number(entry.micros?.vitaminC ?? (scalePer100gValue(readPer100gMicro(enrichedEntry, 'vitaminC'), grams) || 0));
      return totals;
    },
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      cholesterol_mg: 0,
      sodium_mg: 0,
      potassium_mg: 0,
      calcium_mg: 0,
      iron_mg: 0,
      vitamin_a_mcg: 0,
      vitamin_c_mg: 0,
    }
  );
}

export async function createMealLog(payload) {
  const userId = payload.user_id || await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  if (isLocalAuth()) {
    const entry = {
      id: `meal-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...payload,
      user_id: userId,
    };
    const logs = readLocalMealLogs();
    logs.unshift(entry);
    writeLocalMealLogs(logs);
    return entry;
  }

  const dbPayload = {
    user_id: userId,
    meal_id: payload.meal_id,
    food_id: payload.food_id ?? null,
    qty: payload.qty,
    unit_code: payload.unit_code,
    grams_resolved: payload.grams_resolved,
    logged_at: payload.logged_at,
    kcal: payload.kcal,
    protein_g: payload.protein_g,
    carbs_g: payload.carbs_g,
    fat_g: payload.fat_g,
  };

  const { data, error } = await supabase.from('meal_logs').insert(dbPayload).select().single();
  if (error) throw error;
  return data;
}

export async function listMealLogs({ userId = getStoredUserId(), limit = 3 } = {}) {
  if (!userId) throw new Error('Missing user ID');

  if (isLocalAuth()) {
    const meals = [
      ...getCachedCatalogItems('meal', userId),
      ...getCachedCatalogItems('snack', userId),
      ...BUILT_IN_INGREDIENTS,
    ];
    return readLocalMealLogs()
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        meal: meals.find((meal) => meal.id === entry.meal_id) || null,
      }));
  }

  const { data, error } = await supabase
    .from('meal_logs')
    .select(`
      id,
      logged_at,
      kcal,
      grams_resolved,
      qty,
      unit_code,
      meal:meals(id, title, type, unit_conversions, kcal_per_100g)
    `)
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getDailyMealLogSummary({ userId = getStoredUserId(), date = new Date() } = {}) {
  if (!userId) throw new Error('Missing user ID');

  const { start, end } = getLocalDayBounds(date);

  if (isLocalAuth()) {
    const entries = readLocalMealLogs().filter((entry) => {
      if (entry.user_id !== userId) return false;
      const loggedAt = new Date(entry.logged_at);
      return loggedAt >= start && loggedAt < end;
    });
    const catalogItems = [
      ...getCachedCatalogItems('meal', userId),
      ...getCachedCatalogItems('snack', userId),
      ...getCachedCatalogItems('ingredient', userId),
      ...BUILT_IN_INGREDIENTS,
    ];
    const catalogItemsById = new Map(catalogItems.map((item) => [item.id, item]));
    const totals = buildLocalNutrientSummary(entries, catalogItemsById);

    return {
      calories: round2(totals.calories),
      protein_g: round2(totals.protein_g),
      carbs_g: round2(totals.carbs_g),
      fat_g: round2(totals.fat_g),
      fiber_g: round2(totals.fiber_g),
      sugar_g: round2(totals.sugar_g),
      cholesterol_mg: round2(totals.cholesterol_mg),
      sodium_mg: round2(totals.sodium_mg),
      potassium_mg: round2(totals.potassium_mg),
      calcium_mg: round2(totals.calcium_mg),
      iron_mg: round2(totals.iron_mg),
      vitamin_a_mcg: round2(totals.vitamin_a_mcg),
      vitamin_c_mg: round2(totals.vitamin_c_mg),
      count: entries.length,
    };
  }

  const { data, error } = await supabase
    .from('meal_logs')
    .select(`
      id,
      kcal,
      protein_g,
      carbs_g,
      fat_g,
      grams_resolved,
      logged_at,
      meal:meals(
        id,
        unit_conversions
      )
    `)
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString());

  if (error) throw error;

  const entries = data ?? [];
  const totals = buildHostedNutrientSummary(entries);

  return {
    calories: round2(totals.calories),
    protein_g: round2(totals.protein_g),
    carbs_g: round2(totals.carbs_g),
    fat_g: round2(totals.fat_g),
    fiber_g: round2(totals.fiber_g),
    sugar_g: round2(totals.sugar_g),
    cholesterol_mg: round2(totals.cholesterol_mg),
    sodium_mg: round2(totals.sodium_mg),
    potassium_mg: round2(totals.potassium_mg),
    calcium_mg: round2(totals.calcium_mg),
    iron_mg: round2(totals.iron_mg),
    vitamin_a_mcg: round2(totals.vitamin_a_mcg),
    vitamin_c_mg: round2(totals.vitamin_c_mg),
    count: entries.length,
  };
}
