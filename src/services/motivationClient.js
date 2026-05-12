const MOTIVATION_ROUTE = '/api/motivation';
const MOTIVATION_QUEUE_KEY = 'cc-motivation-event-queue-v1';
const MAX_QUEUE_SIZE = 100;

function createQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `motivation-event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readQueuedEvents() {
  try {
    const raw = localStorage.getItem(MOTIVATION_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueuedEvents(queue) {
  localStorage.setItem(MOTIVATION_QUEUE_KEY, JSON.stringify(queue));
}

function queueMotivationEvent(payload, errorMessage = null) {
  const queue = readQueuedEvents();
  const nextQueue = [
    ...queue,
    {
      id: createQueueId(),
      payload,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      lastError: errorMessage,
    },
  ].slice(-MAX_QUEUE_SIZE);

  writeQueuedEvents(nextQueue);
  return nextQueue[nextQueue.length - 1];
}

async function postMotivationEvent(payload) {
  const response = await fetch(MOTIVATION_ROUTE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Motivation event failed with ${response.status}`);
  }

  return response.json().catch(() => ({ ok: true }));
}

async function trySendOrQueue(payload) {
  try {
    return await postMotivationEvent(payload);
  } catch (error) {
    queueMotivationEvent(payload, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export function getQueuedMotivationEventCount() {
  return readQueuedEvents().length;
}

export async function flushQueuedMotivationEvents() {
  const queue = readQueuedEvents();
  if (!queue.length) {
    return { attempted: 0, delivered: 0, remaining: 0 };
  }

  const remaining = [];
  let delivered = 0;

  for (const item of queue) {
    try {
      await postMotivationEvent(item.payload);
      delivered += 1;
    } catch (error) {
      remaining.push({
        ...item,
        retryCount: Number(item.retryCount || 0) + 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastTriedAt: new Date().toISOString(),
      });
    }
  }

  writeQueuedEvents(remaining);
  return {
    attempted: queue.length,
    delivered,
    remaining: remaining.length,
  };
}

export async function sendExerciseLoggedEvent({ userId, minutes, timestampISO, typeId, typeName }) {
  if (!userId || !(Number(minutes) > 0) || !timestampISO) return null;

  return trySendOrQueue({
    eventType: 'exercise_logged',
    userId,
    occurredAt: timestampISO,
    details: {
      minutes: Number(minutes),
      typeId: typeId || null,
      typeName: typeName || null,
    },
  });
}

export async function sendCalorieGoalMetEvent({
  userId,
  date,
  consumedCalories,
  goalCalories,
  maintenanceCalories,
}) {
  if (!userId || !date) return null;

  return trySendOrQueue({
    eventType: 'calorie_goal_met',
    userId,
    occurredAt: new Date().toISOString(),
    details: {
      date,
      consumedCalories: Number(consumedCalories || 0),
      goalCalories: Number(goalCalories || 0),
      maintenanceCalories: Number(maintenanceCalories || 0),
    },
  });
}
