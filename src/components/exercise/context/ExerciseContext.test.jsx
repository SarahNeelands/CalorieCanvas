import React from 'react';
import { act, render, screen } from '@testing-library/react';

jest.mock('../../../services/exerciseClient', () => ({
  archiveExerciseDefinition: jest.fn(), createExerciseDefinition: jest.fn(),
  createExerciseLog: jest.fn(), deleteExerciseLog: jest.fn(),
  listExerciseDefinitions: jest.fn(), listExerciseLogs: jest.fn(),
  syncLocalExerciseState: jest.fn(), updateExerciseDefinition: jest.fn(),
  updateExerciseLog: jest.fn(),
}));

import { ExerciseProvider, useExercise } from './ExerciseContext';

let contextValue;
function Probe() {
  contextValue = useExercise();
  return <div data-testid="shape">{contextValue.state.exerciseTypes.length}:{contextValue.state.logs.length}</div>;
}

beforeEach(() => {
  localStorage.clear();
  contextValue = null;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111') },
  });
  const client = require('../../../services/exerciseClient');
  client.listExerciseDefinitions.mockResolvedValue([]);
  client.listExerciseLogs.mockResolvedValue([]);
  client.syncLocalExerciseState.mockResolvedValue({ committed: true });
  client.createExerciseDefinition.mockImplementation(async (_userId, value) => value);
  client.createExerciseLog.mockImplementation(async (_userId, value) => value);
});

test('the existing context state, actions, helpers, and normalized local log shape remain available', async () => {
  render(<ExerciseProvider userId="local-user"><Probe /></ExerciseProvider>);
  expect(screen.getByTestId('shape')).toHaveTextContent('5:0');
  for (const key of ['state', 'typesById', 'addExerciseType', 'addLog', 'logsForDate', 'helpers']) {
    expect(contextValue).toHaveProperty(key);
  }
  await act(async () => {
    const type = contextValue.addExerciseType('Pilates');
    expect(type).toEqual({ id: 'pilates', name: 'Pilates' });
    contextValue.addLog({ typeId: 'pilates', minutes: 45, timestampISO: '2026-03-08T12:00:00.000Z' });
  });
  expect(contextValue.state.logs[0]).toMatchObject({
    id: '11111111-1111-4111-8111-111111111111', userId: 'local-user',
    typeId: 'pilates', minutes: 45, timestampISO: '2026-03-08T12:00:00.000Z',
  });
  expect(contextValue.logsForDate('2026-03-08')).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem('exercise_page_state_v3')).logs).toHaveLength(1);
});
