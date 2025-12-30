const fs = require('fs');
const path = require('path');
const { loadAdobeActivity } = require('./adapters/adobe');
const { loadProfiles } = require('./adapters/profiles');
const { computeActivityScores } = require('./enrichments/score');
const { computeSegments } = require('./enrichments/segments');
const {
  normalizeEmail,
  sha1Short,
  parseDate,
  toISODate,
  startOfWeekMonday,
  nextMonday,
  weekRange,
  ensureDir,
  writeJSON
} = require('./utils');

const ROOT = path.join(__dirname, '..');
const INPUTS_DIR = path.join(ROOT, 'inputs');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

const START_DATE = new Date(Date.UTC(2025, 5, 1));

function collectUsers(profiles, activity) {
  const users = new Map();

  profiles.forEach((profile) => {
    users.set(profile.email, {
      email: profile.email,
      attributes: {
        name: profile.name,
        department: profile.department,
        geo: profile.geo,
        title: profile.title,
        manager_email: profile.manager_email,
        skip_level_email: profile.skip_level_email
      },
      activity_summary: {
        login_total: 0,
        total_views: 0,
        unique_views: 0,
        last_active_date: ''
      },
      weekly_activity: [],
      dashboard_activity: [],
      derived: {
        segments: [],
        activity_score: 0
      },
      meta: {}
    });
  });

  const activityByUser = new Map();
  const dashboardsByUser = new Map();
  const lastActiveByUser = new Map();

  activity.forEach((record) => {
    const email = normalizeEmail(record.email);
    if (!email) return;

    if (!users.has(email)) {
      users.set(email, {
        email,
        attributes: {
          name: '',
          department: '',
          geo: '',
          title: '',
          manager_email: '',
          skip_level_email: ''
        },
        activity_summary: {
          login_total: 0,
          total_views: 0,
          unique_views: 0,
          last_active_date: ''
        },
        weekly_activity: [],
        dashboard_activity: [],
        derived: {
          segments: [],
          activity_score: 0
        },
        meta: {}
      });
    }

    const weekStart = startOfWeekMonday(record.date);
    const weekKey = toISODate(weekStart);
    const weeklyMap = activityByUser.get(email) || new Map();
    const current = weeklyMap.get(weekKey) || { login: 0, total_views: 0, unique_views: 0 };
    current.login += record.login;
    current.total_views += record.total_views;
    current.unique_views += record.unique_views;
    weeklyMap.set(weekKey, current);
    activityByUser.set(email, weeklyMap);

    if (record.dashboard_name) {
      const dashboardMap = dashboardsByUser.get(email) || new Map();
      const dash = dashboardMap.get(record.dashboard_name) || {
        dashboard_name: record.dashboard_name,
        total_views: 0,
        unique_views: 0,
        last_view_date: ''
      };
      dash.total_views += record.total_views;
      dash.unique_views += record.unique_views;
      const dateKey = toISODate(record.date);
      if (!dash.last_view_date || dateKey > dash.last_view_date) {
        dash.last_view_date = dateKey;
      }
      dashboardMap.set(record.dashboard_name, dash);
      dashboardsByUser.set(email, dashboardMap);
    }

    const last = lastActiveByUser.get(email);
    const dateKey = toISODate(record.date);
    if (!last || dateKey > last) lastActiveByUser.set(email, dateKey);
  });

  const startWeek = nextMonday(START_DATE);
  const endDate = new Date();
  const endWeek = startOfWeekMonday(endDate);
  const weekStarts = weekRange(startWeek, endWeek);
  const generatedAt = new Date().toISOString();

  const userRecords = [];

  users.forEach((user, email) => {
    const weeklyMap = activityByUser.get(email) || new Map();
    const weekly_activity = weekStarts.map((weekDate) => {
      const key = toISODate(weekDate);
      const entry = weeklyMap.get(key) || { login: 0, total_views: 0, unique_views: 0 };
      return { week: key, ...entry };
    });

    const activity_summary = weekly_activity.reduce(
      (acc, entry) => {
        acc.login_total += entry.login;
        acc.total_views += entry.total_views;
        acc.unique_views += entry.unique_views;
        return acc;
      },
      { login_total: 0, total_views: 0, unique_views: 0, last_active_date: '' }
    );

    activity_summary.last_active_date = lastActiveByUser.get(email) || '';

    const dashboardMap = dashboardsByUser.get(email) || new Map();
    const dashboard_activity = Array.from(dashboardMap.values()).sort((a, b) => {
      return b.total_views - a.total_views;
    });

    userRecords.push({
      ...user,
      activity_summary,
      weekly_activity,
      dashboard_activity,
      meta: { generated_at: generatedAt }
    });
  });

  return userRecords;
}

function buildIndex(users) {
  function scoreBucket(score) {
    if (score >= 0.8) return '0.8 - 1.0';
    if (score >= 0.6) return '0.6 - 0.8';
    if (score >= 0.4) return '0.4 - 0.6';
    if (score >= 0.2) return '0.2 - 0.4';
    return '0.0 - 0.2';
  }

  return users.map((user) => {
    const id = `u_${sha1Short(user.email)}`;
    return {
      id,
      email: user.email,
      name: user.attributes.name,
      department: user.attributes.department,
      geo: user.attributes.geo,
      title: user.attributes.title,
      manager_email: user.attributes.manager_email,
      skip_level_email: user.attributes.skip_level_email,
      segments: user.derived.segments,
      activity_score: user.derived.activity_score,
      activity_score_bucket: scoreBucket(user.derived.activity_score),
      login_total: user.activity_summary.login_total,
      total_views: user.activity_summary.total_views,
      unique_views: user.activity_summary.unique_views,
      last_active_date: user.activity_summary.last_active_date,
      path: `/data/users/${id}.json`
    };
  });
}

function buildFacets(index) {
  const facets = {
    department: {},
    geo: {},
    title: {},
    manager_email: {},
    skip_level_email: {},
    segments: {},
    activity_score_bucket: {}
  };

  index.forEach((entry) => {
    const keys = ['department', 'geo', 'title', 'manager_email', 'skip_level_email', 'activity_score_bucket'];
    keys.forEach((key) => {
      const value = entry[key] || '';
      if (!value) return;
      facets[key][value] = (facets[key][value] || 0) + 1;
    });

    (entry.segments || []).forEach((segment) => {
      facets.segments[segment] = (facets.segments[segment] || 0) + 1;
    });
  });

  return facets;
}

function buildDashboards(users) {
  const dashboards = new Map();

  users.forEach((user) => {
    const id = `u_${sha1Short(user.email)}`;
    (user.dashboard_activity || []).forEach((entry) => {
      if (!entry.dashboard_name) return;
      const existing = dashboards.get(entry.dashboard_name) || { name: entry.dashboard_name, users: new Set() };
      existing.users.add(id);
      dashboards.set(entry.dashboard_name, existing);
    });
  });

  return Array.from(dashboards.values())
    .map((entry) => ({
      name: entry.name,
      count: entry.users.size,
      users: Array.from(entry.users)
    }))
    .sort((a, b) => b.count - a.count);
}

function main() {
  const profilesPath = path.join(INPUTS_DIR, 'user_profiles.json');
  const adobePathCsv = path.join(INPUTS_DIR, 'adobe_activity.csv');
  const adobePathJson = path.join(INPUTS_DIR, 'adobe_activity.json');

  const profiles = loadProfiles(profilesPath);
  const adobe = fs.existsSync(adobePathCsv)
    ? loadAdobeActivity(adobePathCsv)
    : loadAdobeActivity(adobePathJson);

  let users = collectUsers(profiles, adobe);
  users = computeActivityScores(users);
  users = computeSegments(users);

  ensureDir(USERS_DIR);

  const index = buildIndex(users);
  const facets = buildFacets(index);
  const dashboards = buildDashboards(users);

  users.forEach((user) => {
    const id = `u_${sha1Short(user.email)}`;
    writeJSON(path.join(USERS_DIR, `${id}.json`), user);
  });

  writeJSON(path.join(DATA_DIR, 'index.json'), index);
  writeJSON(path.join(DATA_DIR, 'facets.json'), facets);
  writeJSON(path.join(DATA_DIR, 'dashboards.json'), dashboards);

  console.log(`Built ${users.length} users.`);
}

main();
