const fs = require('node:fs/promises');
const path = require('node:path');

function createReport(kind) {
  return {
    formatVersion: 1,
    kind,
    startedAt: new Date().toISOString(),
    completedAt: null,
    dryRun: false,
    status: 'running',
    counts: {},
    users: {},
    issues: [],
    derivations: [],
    notes: [],
  };
}

function increment(report, category, status, amount = 1) {
  report.counts[category] ||= {};
  report.counts[category][status] = (report.counts[category][status] || 0) + amount;
}

function incrementUser(report, userId, category, amount = 1) {
  report.users[userId] ||= {
    profile: 0, catalogItems: 0, mealLogs: 0, weights: 0,
    exerciseDefinitions: 0, exerciseLogs: 0,
  };
  report.users[userId][category] += amount;
}

function issue(report, category, code, reference, detail) {
  report.issues.push({ category, code, reference: reference || null, detail });
}

function humanReport(report) {
  const lines = [
    `Calorie Canvas ${report.kind} report`,
    `Status: ${report.status}${report.dryRun ? ' (dry run)' : ''}`,
    `Started: ${report.startedAt}`,
    `Completed: ${report.completedAt || 'not completed'}`,
    '',
    'Counts:',
  ];
  Object.entries(report.counts).forEach(([category, values]) => {
    lines.push(`- ${category}: ${Object.entries(values).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  });
  lines.push('', `Issues requiring review: ${report.issues.length}`);
  report.issues.forEach((entry) => lines.push(`- [${entry.category}/${entry.code}] ${entry.reference || '-'}: ${entry.detail}`));
  lines.push('', 'Per-user reconciliation:');
  Object.entries(report.users).forEach(([userId, counts]) => {
    lines.push(`- ${userId}: ${Object.entries(counts).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join(', ')}`);
  });
  if (report.notes.length) {
    lines.push('', 'Notes:');
    report.notes.forEach((note) => lines.push(`- ${note}`));
  }
  return `${lines.join('\n')}\n`;
}

async function writeReports(report, directory, baseName) {
  await fs.mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, `${baseName}.json`);
  const textPath = path.join(directory, `${baseName}.txt`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await fs.writeFile(textPath, humanReport(report), { mode: 0o600 });
  return { jsonPath, textPath };
}

module.exports = { createReport, humanReport, increment, incrementUser, issue, writeReports };
