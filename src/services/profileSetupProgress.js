import { getCurrentUserId } from './authClient';
import { apiRequest } from './apiClient';

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

export async function hydrateProfileSetupState(userIdArg) {
  const userId = userIdArg || await getCurrentUserId();
  const localState = readState();

  if (!userId) {
    return localState;
  }
  const result = await apiRequest('/profile/setup');
  if (result.error) throw new Error(result.error.message);
  const data = result.payload?.data;
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

  if (!userId) {
    return next;
  }
  const result = await apiRequest('/profile/setup', {
    method: 'PUT', csrf: true,
    body: { setup_last_step: next.lastStep || '/profile-setup', setup_draft: { ...next, completed: false } },
  });
  if (result.error) throw new Error(result.error.message);
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

  if (!userId) {
    return next;
  }
  const result = await apiRequest('/profile/setup/complete', {
    method: 'POST', csrf: true, body: { setup_draft: next },
  });
  if (result.error) throw new Error(result.error.message);
  return next;
}
