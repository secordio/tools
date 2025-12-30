const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function sha1Short(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function nextMonday(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = day === 1 ? 0 : (8 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function weekRange(startDate, endDate) {
  const weeks = [];
  let cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    weeks.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function parseCSV(content) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell !== '')) rows.push(row);

  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((cells) => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = cells[idx] === undefined ? '' : cells[idx].trim();
    });
    return record;
  });
}

module.exports = {
  normalizeEmail,
  sha1Short,
  safeNumber,
  parseDate,
  toISODate,
  startOfWeekMonday,
  nextMonday,
  weekRange,
  ensureDir,
  readJSON,
  writeJSON,
  parseCSV
};
