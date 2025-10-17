// TODO: swap these stubs with real DB calls.
// Return arrays like [{ date: '2025-10-12', label: 'Sun', value: 73.2, extra: {...}}]

export async function fetchWeightSeries(userId, scope = 'all') {
  // scope: 'all' | 'month' | 'week'
  // Weight won't have weekly if you truly don't want it—just return [] for 'week'.
  if (scope === 'week') return []; // per your note
  // Demo data
  const base = [
    { date: '2025-10-01', label: 'Wed', value: 201.2 },
    { date: '2025-10-02', label: 'Thu', value: 200.9 },
    { date: '2025-10-03', label: 'Fri', value: 200.1 },
    { date: '2025-10-04', label: 'Sat', value: 199.8 },
    { date: '2025-10-05', label: 'Sun', value: 199.5 },
    { date: '2025-10-06', label: 'Mon', value: 199.4 },
    { date: '2025-10-07', label: 'Tue', value: 199.1 },
  ];
  if (scope === 'month') return base;
  if (scope === 'all') return base; // return longer range in real code
  return [];
}

export async function fetchCalorieSeries(userId, scope = 'all') {
  // value = total calories
  const week = [
    { date: '2025-10-01', label: 'Mon', value: 1500, extra: { calories: 1500 } },
    { date: '2025-10-02', label: 'Tue', value: 1750, extra: { calories: 1750 } },
    { date: '2025-10-03', label: 'Wed', value: 1400, extra: { calories: 1400 } },
    { date: '2025-10-04', label: 'Thu', value: 1600, extra: { calories: 1600 } },
    { date: '2025-10-05', label: 'Fri', value: 1900, extra: { calories: 1900 } },
    { date: '2025-10-06', label: 'Sat', value: 1200, extra: { calories: 1200 } },
    { date: '2025-10-07', label: 'Sun', value: 1650, extra: { calories: 1650 } },
  ];
  if (scope === 'week') return week;
  if (scope === 'month') return week; // demo
  if (scope === 'all') return week;   // demo
  return [];
}

export async function fetchExerciseSeries(userId, scope = 'all') {
  // value = total minutes; extra.types = breakdown
  const week = [
    { date: '2025-10-01', label: 'Mon', value: 45, extra: { types: [{name:'Running', minutes:20},{name:'Yoga', minutes:25}] } },
    { date: '2025-10-02', label: 'Tue', value: 30, extra: { types: [{name:'Strength', minutes:30}] } },
    { date: '2025-10-03', label: 'Wed', value: 0,  extra: { types: [] } },
    { date: '2025-10-04', label: 'Thu', value: 60, extra: { types: [{name:'Cycling', minutes:60}] } },
    { date: '2025-10-05', label: 'Fri', value: 15, extra: { types: [{name:'Walking', minutes:15}] } },
    { date: '2025-10-06', label: 'Sat', value: 50, extra: { types: [{name:'Swimming', minutes:50}] } },
    { date: '2025-10-07', label: 'Sun', value: 25, extra: { types: [{name:'Yoga', minutes:25}] } },
  ];
  if (scope === 'week') return week;
  if (scope === 'month') return week; // demo
  if (scope === 'all') return week;   // demo
  return [];
}
