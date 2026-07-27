const mockApiRequest = jest.fn();
jest.mock('./authClient', () => ({
  getCurrentUserId: jest.fn(async () => 'session-user'),
  getStoredUserId: jest.fn(() => 'session-user'),
}));
jest.mock('./apiClient', () => ({ apiRequest: (...args) => mockApiRequest(...args) }));
jest.mock('./profileSetupProgress', () => ({ getProfileSetupState: () => ({}) }));
import {
  getLatestWeightKg,
  getProfile,
  resolveDailyCalorieGoal,
  updateProfile,
} from './profileClient';

beforeEach(() => {
  localStorage.clear();
  mockApiRequest.mockReset();
});

test('Express profile writes preserve the service shape without sending an owner ID', async () => {
  mockApiRequest.mockResolvedValue({
    payload: {
      data: {
        user_id: 'session-user',
        display_name: 'Alice',
        height_cm: 168.5,
        weight_kg: 70.25,
        activity_level: 'sedentary',
        goal_weight_intent: 'maintain',
        goal_muscle_intent: 'maintain',
        pref_show_calories: true,
        pref_show_macros: true,
        pref_show_micros: false,
        pref_show_exercise: true,
        pref_show_weight: true,
      },
    },
    error: null,
  });

  const profile = await updateProfile({ display_name: 'Alice' }, 'client-user-value');
  expect(profile.user_id).toBe('session-user');
  expect(profile.height_cm).toBe(168.5);
  expect(mockApiRequest).toHaveBeenCalledWith('/profile', expect.objectContaining({
    method: 'PUT',
    csrf: true,
  }));
  const requestBody = mockApiRequest.mock.calls[0][1].body;
  expect(requestBody.user_id).toBeUndefined();
  expect(requestBody.display_name).toBe('Alice');
});

test('Express reads retain normalized profile and latest-weight return values', async () => {
  mockApiRequest
    .mockResolvedValueOnce({
      payload: { data: { user_id: 'session-user', display_name: 'Alice', weight_kg: 70 } },
      error: null,
    })
    .mockResolvedValueOnce({
      payload: { data: { date: '2026-07-22', value: 154.324, unit: 'lb' } },
      error: null,
    });

  const profile = await getProfile('session-user');
  expect(profile).toEqual(expect.objectContaining({ user_id: 'session-user', display_name: 'Alice' }));
  await expect(getLatestWeightKg('session-user')).resolves.toBeCloseTo(70, 3);
});

test('calculated calorie goal follows current weight when no explicit goal is set', () => {
  const profile = {
    dob: '1990-01-01',
    gender: 'male',
    height_cm: 180,
    activity_level: 'moderately_active',
    goal_weight_intent: 'maintain',
    calorie_goal: null,
  };
  const lighterGoal = resolveDailyCalorieGoal({ ...profile, weight_kg: 70 });
  const heavierGoal = resolveDailyCalorieGoal({ ...profile, weight_kg: 90 });
  expect(heavierGoal).toBeGreaterThan(lighterGoal);
});

test('explicit calorie goal is preserved when weight changes', () => {
  const profile = {
    dob: '1990-01-01',
    gender: 'female',
    height_cm: 165,
    activity_level: 'lightly_active',
    goal_weight_intent: 'normal_loss',
    calorie_goal: 2100,
  };
  expect(resolveDailyCalorieGoal({ ...profile, weight_kg: 60 })).toBe(2100);
  expect(resolveDailyCalorieGoal({ ...profile, weight_kg: 90 })).toBe(2100);
});
