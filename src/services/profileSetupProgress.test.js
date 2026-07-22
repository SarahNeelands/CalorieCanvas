const mockApiRequest = jest.fn();

jest.mock('./authClient', () => ({ getCurrentUserId: jest.fn(async () => 'session-user') }));
jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));

import {
  completeProfileSetupPersisted,
  hydrateProfileSetupState,
  persistProfileSetupState,
} from './profileSetupProgress';

beforeEach(() => {
  localStorage.clear();
  mockApiRequest.mockReset();
});

test('Express setup progress hydrates and preserves the existing local state shape', async () => {
  mockApiRequest.mockResolvedValue({
    payload: {
      data: {
        setup_completed: false,
        setup_last_step: '/profile-setup-3',
        setup_draft: { name: 'Alice', heightCm: 168 },
      },
    },
    error: null,
  });
  const state = await hydrateProfileSetupState('ignored-owner');
  expect(state).toEqual({
    name: 'Alice',
    heightCm: 168,
    completed: false,
    lastStep: '/profile-setup-3',
  });
  expect(mockApiRequest).toHaveBeenCalledWith('/profile/setup');
});

test('Express setup writes use shared CSRF state and never send user_id', async () => {
  mockApiRequest.mockResolvedValue({ payload: { data: {} }, error: null });
  const state = await persistProfileSetupState({
    name: 'Alice',
    lastStep: '/profile-setup-2',
  }, 'ignored-owner');
  expect(state.lastStep).toBe('/profile-setup-2');
  const saveOptions = mockApiRequest.mock.calls[0][1];
  expect(saveOptions.csrf).toBe(true);
  expect(saveOptions.body.user_id).toBeUndefined();
  expect(saveOptions.body.setup_draft.name).toBe('Alice');

  await completeProfileSetupPersisted('ignored-owner');
  expect(mockApiRequest).toHaveBeenLastCalledWith('/profile/setup/complete', expect.objectContaining({
    method: 'POST',
    csrf: true,
  }));
});
