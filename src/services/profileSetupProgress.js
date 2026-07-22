import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId } from './authClient';

const STORAGE_KEY = 'profile_setup_progress_v1';

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getProfileSetupState() {
  return readState();
}

export function updateProfileSetupState(patch) {
  const next = { ...readState(), ...patch };
  writeState(next);
  return next;
}

function buildRemoteSetupPayload(state, userId) {
  return {
    user_id: userId,
    setup_completed: Boolean(state.completed),
    setup_last_step: state.completed ? null : (state.lastStep || '/profile-setup'),
    setup_draft: state,
  };
}

export async function hydrateProfileSetupState(userIdArg) {
  const userId = userIdArg || await getCurrentUserId();
  const localState = readState();

  if (!userId || isLocalAuth()) {
    return localState;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('setup_completed, setup_last_step, setup_draft')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return localState;
  }

  const merged = {
    ...(data.setup_draft || {}),
    ...localState,
    completed: data.setup_completed ?? localState.completed ?? false,
    lastStep: data.setup_last_step ?? localState.lastStep ?? null,
  };

  writeState(merged);
  return merged;
}

export function hasCompletedRequiredProfileSetup(profile) {
  if (!profile) return false;
  const hasName = Boolean(String(profile.display_name || '').trim());
  const hasDob = Boolean(profile.dob);
  const hasGender = Boolean(String(profile.gender || '').trim());
  const hasHeight = Number(profile.height_cm) > 0;
  const hasWeight = Number(profile.weight_kg) > 0;
  const hasActivityLevel = Boolean(String(profile.activity_level || '').trim());
  return hasName && hasDob && hasGender && hasHeight && hasWeight && hasActivityLevel;
}

export function ensureProfileSetupRequired(resumePath = '/profile-setup') {
  const state = readState();
  if (state.completed) {
    writeState({ ...state, completed: false, lastStep: resumePath });
    return;
  }
  if (!state.lastStep) {
    writeState({ ...state, completed: false, lastStep: resumePath });
  }
}

export async function persistProfileSetupState(patch, userIdArg) {
  const next = updateProfileSetupState(patch);
  const userId = userIdArg || await getCurrentUserId();

  if (!userId || isLocalAuth()) {
    return next;
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(buildRemoteSetupPayload(next, userId), { onConflict: 'user_id' });

  if (error) {
    throw error;
  }

  return next;
}

export function setProfileSetupStep(path) {
  updateProfileSetupState({ lastStep: path, completed: false });
}

export function initializeProfileSetup() {
  writeState({ lastStep: '/profile-setup', completed: false });
}

export function getProfileSetupResumePath() {
  const state = readState();
  if (state.completed) return null;
  return state.lastStep || null;
}

export function completeProfileSetup() {
  const state = readState();
  writeState({ ...state, completed: true });
}

export async function completeProfileSetupPersisted(userIdArg) {
  const next = updateProfileSetupState({ completed: true, lastStep: null });
  const userId = userIdArg || await getCurrentUserId();

  if (!userId || isLocalAuth()) {
    return next;
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(buildRemoteSetupPayload(next, userId), { onConflict: 'user_id' });

  if (error) {
    throw error;
  }

  return next;
}
