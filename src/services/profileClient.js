import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId, getStoredUserId } from './authClient';
import { getProfileSetupState } from './profileSetupProgress';

const LOCAL_PROFILES_KEY = 'local_profiles_v1';

function readLocalProfiles() {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalProfiles(profiles) {
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
}

export function getCachedProfile(userId = getStoredUserId()) {
  if (!userId) return null;
  const localProfiles = readLocalProfiles();
  return localProfiles[userId] || null;
}

function readLegacyWeights() {
  try {
    const raw = localStorage.getItem('cc.weights');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toCmFromLegacyHeight(value, unit) {
  const numericValue = Number(value || 0);
  if (!(numericValue > 0)) return null;
  const normalizedUnit = String(unit || 'cm').trim().toLowerCase();
  if (normalizedUnit === 'cm') return numericValue;
  if (normalizedUnit === 'm') return numericValue * 100;
  if (normalizedUnit === 'in' || normalizedUnit === 'inch' || normalizedUnit === 'inches') return numericValue * 2.54;
  if (normalizedUnit === 'ft' || normalizedUnit === 'feet') return numericValue * 30.48;
  return numericValue;
}

function toKgFromLegacyWeight(value, unit) {
  const numericValue = Number(value || 0);
  if (!(numericValue > 0)) return null;
  const normalizedUnit = String(unit || 'kg').trim().toLowerCase();
  if (normalizedUnit === 'kg' || normalizedUnit === 'kgs') return numericValue;
  if (normalizedUnit === 'lb' || normalizedUnit === 'lbs' || normalizedUnit === 'pounds') {
    return numericValue * 0.45359237;
  }
  return numericValue;
}

function getLatestLegacyWeightKg() {
  const latest = readLegacyWeights()
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];

  if (!latest) return null;
  return toKgFromLegacyWeight(latest.value, latest.unit);
}

function getLatestLocalWeightKg(userId) {
  const latest = readLegacyWeights()
    .filter((entry) => entry && typeof entry === 'object' && (!entry.user_id || entry.user_id === userId))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];

  if (!latest) return null;
  return toKgFromLegacyWeight(latest.value, latest.unit);
}

function normalizeProfileShape(profile, draft, userId) {
  const latestLegacyWeightKg = getLatestLegacyWeightKg();
  const legacyHeightCm = toCmFromLegacyHeight(profile?.height, profile?.heightUnit);
  const legacyWeightKg = toKgFromLegacyWeight(profile?.weight, profile?.weightUnit);
  const legacyGoalTypeMap = {
    1: 'rapid_loss',
    2: 'normal_loss',
    3: 'maintain',
    4: 'normal_gain',
    5: 'rapid_gain',
  };
  const rawGoalType = profile?.goal_weight_intent ?? profile?.goalType ?? draft?.goal ?? 'maintain';
  const normalizedGoalType =
    legacyGoalTypeMap[Number(rawGoalType)] ||
    rawGoalType;

  return {
    ...profile,
    user_id: userId,
    display_name: profile?.display_name ?? profile?.name ?? draft?.name ?? null,
    dob: profile?.dob ?? profile?.birthday ?? draft?.dob ?? null,
    gender: profile?.gender ?? draft?.gender ?? null,
    height_cm: profile?.height_cm ?? profile?.heightCm ?? legacyHeightCm ?? draft?.heightCm ?? null,
    weight_kg: profile?.weight_kg ?? profile?.weightKg ?? legacyWeightKg ?? draft?.weightKg ?? latestLegacyWeightKg ?? null,
    activity_level: profile?.activity_level ?? profile?.activityLevel ?? draft?.activityLevel ?? 'sedentary',
    goal_weight_intent: normalizedGoalType,
    goal_muscle_intent: profile?.goal_muscle_intent ?? draft?.muscle ?? 'maintain',
    calorie_goal: profile?.calorie_goal ?? profile?.calculated_calorie_goal ?? draft?.calorieGoal ?? null,
    target_weight_kg: profile?.target_weight_kg ?? (draft?.targetWeight ? Number(draft.targetWeight) : null),
    target_body_fat_pct: profile?.target_body_fat_pct ?? (draft?.targetBf ? Number(draft.targetBf) : null),
    pref_show_calories: profile?.pref_show_calories ?? true,
    pref_show_macros: profile?.pref_show_macros ?? true,
    pref_show_micros: profile?.pref_show_micros ?? false,
    pref_show_exercise: profile?.pref_show_exercise ?? true,
    pref_show_weight: profile?.pref_show_weight ?? true,
  };
}

export function saveLocalProfile(userId, profile) {
  if (!userId) return null;
  const profiles = readLocalProfiles();
  const nextProfile = {
    ...(profiles[userId] || {}),
    ...profile,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  profiles[userId] = nextProfile;
  writeLocalProfiles(profiles);
  return nextProfile;
}

export async function updateProfile(profile, userIdArg) {
  const userId = userIdArg || await getCurrentUserId();
  if (!userId) {
    throw new Error('Missing user ID');
  }

  const normalizedProfile = normalizeProfileShape(profile || {}, {}, userId);
  saveLocalProfile(userId, normalizedProfile);

  if (isLocalAuth()) {
    return normalizedProfile;
  }

  const payload = {
    user_id: userId,
    display_name: normalizedProfile.display_name,
    dob: normalizedProfile.dob,
    gender: normalizedProfile.gender,
    height_cm: normalizedProfile.height_cm,
    weight_kg: normalizedProfile.weight_kg,
    activity_level: normalizedProfile.activity_level,
    goal_weight_intent: normalizedProfile.goal_weight_intent,
    goal_muscle_intent: normalizedProfile.goal_muscle_intent,
    calorie_goal: normalizedProfile.calorie_goal,
    target_weight_kg: normalizedProfile.target_weight_kg,
    target_body_fat_pct: normalizedProfile.target_body_fat_pct,
    pref_show_calories: normalizedProfile.pref_show_calories,
    pref_show_macros: normalizedProfile.pref_show_macros,
    pref_show_micros: normalizedProfile.pref_show_micros,
    pref_show_exercise: normalizedProfile.pref_show_exercise,
    pref_show_weight: normalizedProfile.pref_show_weight,
  };

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;

  return normalizedProfile;
}

export async function getProfile(userId = getStoredUserId()) {
  if (!userId) return null;

  const localProfiles = readLocalProfiles();
  const localProfile = localProfiles[userId] || null;
  const draft = getProfileSetupState();

  if (isLocalAuth()) {
    const fallbackProfile = localProfile;

    if (!fallbackProfile && !draft?.heightCm && !draft?.weightKg) {
      return null;
    }

    return normalizeProfileShape(fallbackProfile || {}, draft, userId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      user_id,
      display_name,
      dob,
      gender,
      height_cm,
      weight_kg,
      activity_level,
      goal_weight_intent,
      goal_muscle_intent,
      calorie_goal,
      target_weight_kg,
      target_body_fat_pct,
      pref_show_calories,
      pref_show_macros,
      pref_show_micros,
      pref_show_exercise,
      pref_show_weight
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  const fallbackProfile = data || localProfile || {};
  if (!data && !localProfile && !draft?.heightCm && !draft?.weightKg) {
    return null;
  }

  return normalizeProfileShape(fallbackProfile, draft, userId);
}

function calculateAge(dob) {
  if (!dob) return 30;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 30;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  const beforeBirthday =
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < birthDate.getDate());

  if (beforeBirthday) age -= 1;
  return Math.max(18, age);
}

function getSexConstant(gender) {
  const normalized = String(gender || '').trim().toLowerCase();
  if (normalized === 'male') return 5;
  if (normalized === 'female') return -161;
  return -78;
}

export function calculateBmr(profile) {
  const weightKg = Number(profile?.weight_kg ?? profile?.weightKg ?? 0);
  const heightCm = Number(profile?.height_cm ?? profile?.heightCm ?? 0);

  if (!(weightKg > 0) || !(heightCm > 0)) {
    return null;
  }

  const age = calculateAge(profile?.dob);
  const bmr =
    (10 * weightKg) +
    (6.25 * heightCm) -
    (5 * age) +
    getSexConstant(profile?.gender);

  return Math.round(Math.max(800, bmr));
}

function resolveActivityFactor(profile) {
  const rawValue = profile?.activity_level ?? profile?.activityLevel ?? null;

  const numericMap = {
    1: 1.2,
    2: 1.375,
    3: 1.55,
    4: 1.725,
    5: 1.9,
  };

  if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue) && numericMap[numericValue]) {
      return numericMap[numericValue];
    }

    const normalized = String(rawValue).trim().toLowerCase();
    const stringMap = {
      sedentary: 1.2,
      lightly_active: 1.375,
      lightlyactive: 1.375,
      light: 1.375,
      moderately_active: 1.55,
      moderatelyactive: 1.55,
      moderate: 1.55,
      very_active: 1.725,
      veryactive: 1.725,
      athlete: 1.9,
      athlete_level: 1.9,
      athletelevel: 1.9,
    };

    if (stringMap[normalized]) {
      return stringMap[normalized];
    }
  }

  return 1.2;
}

export function calculateDailyCalorieGoal(profile) {
  const bmr = calculateBmr(profile);

  if (!(bmr > 0)) {
    return null;
  }

  let goal = bmr * resolveActivityFactor(profile);

  const weightIntent = profile?.goal_weight_intent ?? profile?.goal;
  const weightAdjustments = {
    rapid_loss: -1050,
    normal_loss: -625,
    maintain: 0,
    normal_gain: 275,
    rapid_gain: 600,
  };

  goal += weightAdjustments[weightIntent] ?? 0;

  return Math.round(Math.min(4500, Math.max(1200, goal)));
}

export async function getLatestWeightKg(userId = getStoredUserId()) {
  if (!userId) return null;

  if (isLocalAuth()) {
    return getLatestLocalWeightKg(userId);
  }

  const { data, error } = await supabase
    .from('weights')
    .select('date,value,unit')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toKgFromLegacyWeight(data.value, data.unit);
}
