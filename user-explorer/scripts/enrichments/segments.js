function hasExecutiveTitle(title) {
  if (!title) return false;
  const upper = title.toUpperCase();
  return ['VP', 'SVP', 'EVP', 'CHIEF', 'DIRECTOR'].some((token) => upper.includes(token));
}

function computeSegments(users) {
  const total = users.length;
  const sorted = [...users].sort((a, b) => b.derived.activity_score - a.derived.activity_score);
  const topCount = Math.max(1, Math.ceil(total * 0.1));
  const bottomCount = Math.max(1, Math.ceil(total * 0.2));

  const topIds = new Set(sorted.slice(0, topCount).map((user) => user.email));
  const bottomIds = new Set(sorted.slice(-bottomCount).map((user) => user.email));

  return users.map((user) => {
    const segments = [];
    if (topIds.has(user.email)) segments.push('power_user');

    const hasProfile = Boolean(user.attributes && user.attributes.name);
    if (bottomIds.has(user.email) && hasProfile) segments.push('low_adopter');

    const department = (user.attributes.department || '').toLowerCase();
    if (department === 'executive' || hasExecutiveTitle(user.attributes.title)) {
      segments.push('exec_team');
    }

    return { ...user, derived: { ...user.derived, segments } };
  });
}

module.exports = { computeSegments };
