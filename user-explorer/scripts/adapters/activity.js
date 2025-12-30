const fs = require('fs');
const path = require('path');
const { normalizeEmail, safeNumber, parseDate, parseCSV } = require('../utils');

function pickValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return '';
}

function normalizeRecord(record) {
  const email = normalizeEmail(pickValue(record, ['email', 'Email', 'user_email', 'userEmail']));
  const dateRaw = pickValue(record, ['date', 'Date', 'activity_date', 'activityDate']);
  const date = parseDate(dateRaw);
  if (!email || !date) return null;

  return {
    email,
    date,
    login: safeNumber(pickValue(record, ['login', 'logins', 'Login'])),
    total_views: safeNumber(pickValue(record, ['total_views', 'totalViews', 'Total Views'])),
    unique_views: safeNumber(pickValue(record, ['unique_views', 'uniqueViews', 'Unique Views'])),
    dashboard_name: pickValue(record, ['dashboard_name', 'dashboard', 'dashboardName', 'Dashboard']) || ''
  };
}

function loadActivity(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const ext = path.extname(filePath).toLowerCase();
  let records = [];

  if (ext === '.json') {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    records = Array.isArray(raw) ? raw : raw.records || [];
  } else {
    const content = fs.readFileSync(filePath, 'utf8');
    records = parseCSV(content);
  }

  return records.map(normalizeRecord).filter(Boolean);
}

module.exports = { loadActivity };
