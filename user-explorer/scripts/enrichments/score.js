function computeActivityScores(users) {
  const metrics = users.map((user) => ({
    login_total: user.activity_summary.login_total,
    total_views: user.activity_summary.total_views,
    unique_views: user.activity_summary.unique_views
  }));

  const mins = { login_total: Infinity, total_views: Infinity, unique_views: Infinity };
  const maxs = { login_total: -Infinity, total_views: -Infinity, unique_views: -Infinity };

  metrics.forEach((metric) => {
    Object.keys(metric).forEach((key) => {
      mins[key] = Math.min(mins[key], metric[key]);
      maxs[key] = Math.max(maxs[key], metric[key]);
    });
  });

  return users.map((user) => {
    const norm = {};
    Object.keys(mins).forEach((key) => {
      const range = maxs[key] - mins[key];
      norm[key] = range === 0 ? 0 : (user.activity_summary[key] - mins[key]) / range;
    });

    const score = 0.2 * norm.login_total + 0.4 * norm.total_views + 0.4 * norm.unique_views;
    return { ...user, derived: { ...user.derived, activity_score: Number(score.toFixed(4)) } };
  });
}

module.exports = { computeActivityScores };
