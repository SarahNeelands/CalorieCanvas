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
