const fs = require('fs');
const path = require('path');
const { normalizeEmail } = require('../utils');

function loadProfiles(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(raw) ? raw : raw.users || [];

  return records
    .map((record) => ({
      email: normalizeEmail(record.email),
      name: record.name || '',
      department: record.department || '',
      geo: record.geo || '',
      title: record.title || '',
      manager_email: normalizeEmail(record.manager_email),
      skip_level_email: normalizeEmail(record.skip_level_email)
    }))
    .filter((record) => record.email);
}

module.exports = { loadProfiles };
