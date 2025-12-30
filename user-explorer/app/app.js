const state = {
  index: [],
  facets: {},
  filters: {},
  searchTerm: '',
  sortKey: 'activity_score',
  selectedId: null,
  selectedDashboard: null,
  dashboardUsers: new Map(),
  dashboards: [],
  view: 'users',
  compact: false,
  miniSearch: null,
  userCache: new Map(),
  chart: null
};

const els = {
  search: document.getElementById('searchInput'),
  sort: document.getElementById('sortSelect'),
  filters: document.getElementById('filters'),
  results: document.getElementById('results'),
  detail: document.getElementById('detail'),
  count: document.getElementById('resultCount'),
  distribution: document.getElementById('distribution'),
  clear: document.getElementById('clearFilters'),
  tabUsers: document.getElementById('tabUsers'),
  tabBreakdown: document.getElementById('tabBreakdown'),
  dashboardInput: document.getElementById('dashboardInput'),
  dashboardOptions: document.getElementById('dashboardOptions'),
  dashboardMeta: document.getElementById('dashboardMeta'),
  clearDashboard: document.getElementById('clearDashboard'),
  compactToggle: document.getElementById('compactToggle')
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDate(value) {
  return value ? value : '—';
}

function sortResults(list) {
  const sorted = [...list];
  switch (state.sortKey) {
    case 'alpha':
      sorted.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      break;
    case 'total_views':
      sorted.sort((a, b) => b.total_views - a.total_views);
      break;
    case 'unique_views':
      sorted.sort((a, b) => b.unique_views - a.unique_views);
      break;
    case 'login_total':
      sorted.sort((a, b) => b.login_total - a.login_total);
      break;
    case 'recent':
      sorted.sort((a, b) => (b.last_active_date || '').localeCompare(a.last_active_date || ''));
      break;
    default:
      sorted.sort((a, b) => b.activity_score - a.activity_score);
  }
  return sorted;
}

function getFilteredResults() {
  let results = [];
  if (state.searchTerm) {
    results = state.miniSearch.search(state.searchTerm, { prefix: true, fuzzy: 0.2 });
  } else {
    results = state.index;
  }

  const filtered = results.filter((entry) => {
    if (state.selectedDashboard) {
      const users = state.dashboardUsers.get(state.selectedDashboard) || new Set();
      if (!users.has(entry.id)) return false;
    }
    return Object.entries(state.filters).every(([facet, values]) => {
      if (!values || values.size === 0) return true;
      if (facet === 'segments') {
        return entry.segments && entry.segments.some((segment) => values.has(segment));
      }
      return values.has(entry[facet]);
    });
  });

  return sortResults(filtered);
}

function renderFilters() {
  els.filters.innerHTML = '';
  const order = ['segments', 'activity_score_bucket', 'geo', 'department'];
  const remaining = Object.keys(state.facets).filter((facet) => !order.includes(facet));
  const facetsInOrder = [...order, ...remaining];

  facetsInOrder.forEach((facet) => {
    const values = state.facets[facet];
    if (!values) return;
    const group = document.createElement('div');
    group.className = 'filter-group';
    const title = document.createElement('h3');
    title.textContent = facet.replace(/_/g, ' ');
    group.appendChild(title);

    const options = document.createElement('div');
    options.className = 'filter-options';

    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, count]) => {
        const option = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = label;
        checkbox.checked = state.filters[facet]?.has(label) || false;
        checkbox.addEventListener('change', () => {
          if (!state.filters[facet]) state.filters[facet] = new Set();
          if (checkbox.checked) {
            state.filters[facet].add(label);
          } else {
            state.filters[facet].delete(label);
          }
          renderResults();
          updateURL();
        });
        option.appendChild(checkbox);
        option.appendChild(document.createTextNode(`${label} (${count})`));
        options.appendChild(option);
      });

    group.appendChild(options);
    els.filters.appendChild(group);
  });
}

function renderResults() {
  const results = getFilteredResults();
  els.results.innerHTML = '';
  const dashboardSuffix = state.selectedDashboard ? ` • ${state.selectedDashboard}` : '';
  els.count.textContent = `${results.length} results${dashboardSuffix}`;
  renderDistribution(results);

  results.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    if (state.compact) card.classList.add('compact');
    if (entry.id === state.selectedId) card.classList.add('active');

    const title = document.createElement('div');
    title.className = 'result-title';
    title.innerHTML = `<span>${entry.name || entry.email}</span><span>${(entry.activity_score || 0).toFixed(2)}</span>`;

    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.textContent = `${entry.title || 'No title'} • ${entry.department || 'No department'} • ${entry.geo || '—'}`;

    const segments = document.createElement('div');
    (entry.segments || []).forEach((segment) => {
      const pill = document.createElement('span');
      pill.className = 'segment-pill';
      pill.textContent = segment;
      segments.appendChild(pill);
    });

    const summary = document.createElement('div');
    summary.className = 'result-meta result-summary';
    summary.textContent = `Logins ${formatNumber(entry.login_total)} • Views ${formatNumber(entry.total_views)} • Unique ${formatNumber(entry.unique_views)}`;

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(segments);
    card.appendChild(summary);

    card.addEventListener('click', () => {
      state.selectedId = entry.id;
      renderResults();
      showDetail(entry);
    });

    els.results.appendChild(card);
  });
}

function updateURL() {
  const params = new URLSearchParams();
  if (state.searchTerm) params.set('q', state.searchTerm);
  if (state.sortKey && state.sortKey !== 'activity_score') params.set('sort', state.sortKey);
  if (state.view && state.view !== 'users') params.set('view', state.view);
  if (state.compact) params.set('compact', '1');
  if (state.selectedDashboard) params.set('dashboard', state.selectedDashboard);

  Object.entries(state.filters).forEach(([facet, values]) => {
    if (!values || values.size === 0) return;
    params.set(`f_${facet}`, Array.from(values).join(','));
  });

  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', next);
}

function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  state.searchTerm = params.get('q') || '';
  state.sortKey = params.get('sort') || 'activity_score';
  state.view = params.get('view') || 'users';
  state.compact = params.get('compact') === '1';
  state.selectedDashboard = params.get('dashboard') || null;

  state.filters = {};
  params.forEach((value, key) => {
    if (!key.startsWith('f_')) return;
    const facet = key.replace('f_', '');
    const values = value.split(',').map((item) => item.trim()).filter(Boolean);
    if (values.length) state.filters[facet] = new Set(values);
  });

  if (state.selectedDashboard && !state.dashboards.find((dash) => dash.name === state.selectedDashboard)) {
    state.selectedDashboard = null;
  }

  els.search.value = state.searchTerm;
  els.sort.value = state.sortKey;
  els.compactToggle.checked = state.compact;
}

function renderView() {
  const isBreakdown = state.view === 'breakdown';
  els.distribution.style.display = isBreakdown ? 'grid' : 'none';
  els.results.style.display = isBreakdown ? 'none' : 'grid';
  els.tabUsers.classList.toggle('active', !isBreakdown);
  els.tabBreakdown.classList.toggle('active', isBreakdown);
  els.compactToggle.disabled = isBreakdown;
}

function renderDistribution(results) {
  const facets = [
    'segments',
    'activity_score_bucket',
    'geo',
    'department',
    'title',
    'manager_email',
    'skip_level_email'
  ];
  els.distribution.innerHTML = '';

  facets.forEach((facet) => {
    const counts = new Map();
    results.forEach((entry) => {
      if (facet === 'segments') {
        (entry.segments || []).forEach((segment) => {
          counts.set(segment, (counts.get(segment) || 0) + 1);
        });
        return;
      }
      const value = entry[facet];
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    if (!counts.size) return;

    const group = document.createElement('div');
    group.className = 'dist-group';
    const title = document.createElement('h3');
    title.textContent = facet.replace(/_/g, ' ');
    group.appendChild(title);

    const items = document.createElement('div');
    items.className = 'dist-items';

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([label, count]) => {
      const item = document.createElement('div');
      item.className = 'dist-item';
      item.innerHTML = `<div>${label}</div><span>${count}</span>`;
      items.appendChild(item);
    });

    group.appendChild(items);
    els.distribution.appendChild(group);
  });
}

function renderDashboards() {
  els.dashboardOptions.innerHTML = '';
  if (!state.dashboards.length) {
    els.dashboardMeta.textContent = 'No dashboards found.';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.dashboards.forEach((dash) => {
    const option = document.createElement('option');
    option.value = dash.name;
    fragment.appendChild(option);
  });
  els.dashboardOptions.appendChild(fragment);
  if (state.selectedDashboard) {
    const match = state.dashboards.find((dash) => dash.name === state.selectedDashboard);
    els.dashboardMeta.textContent = match ? `${match.count} users` : '';
    els.dashboardInput.value = state.selectedDashboard;
  } else {
    els.dashboardMeta.textContent = `${state.dashboards.length} dashboards available`;
    els.dashboardInput.value = '';
  }
}

function renderDetail(user) {
  const segments = (user.derived.segments || [])
    .map((segment) => `<span class="segment-pill">${segment}</span>`)
    .join('');

  const weekly = user.weekly_activity || [];
  const labels = weekly.map((entry) => entry.week);
  const loginData = weekly.map((entry) => entry.login);
  const totalViewsData = weekly.map((entry) => entry.total_views);
  const uniqueViewsData = weekly.map((entry) => entry.unique_views);

  const dashboardRows = (user.dashboard_activity || [])
    .map(
      (entry) => `
        <tr>
          <td>${entry.dashboard_name}</td>
          <td>${formatNumber(entry.total_views)}</td>
          <td>${formatNumber(entry.unique_views)}</td>
          <td>${formatDate(entry.last_view_date)}</td>
        </tr>
      `
    )
    .join('');

  els.detail.innerHTML = `
    <div class="detail-block">
      <h3>${user.attributes.name || user.email}</h3>
      <div class="result-meta">${user.email}</div>
      <div>${segments || '<span class="result-meta">No segments</span>'}</div>
    </div>
    <div class="detail-block">
      <div class="detail-grid">
        <div><strong>Title</strong>${user.attributes.title || '—'}</div>
        <div><strong>Department</strong>${user.attributes.department || '—'}</div>
        <div><strong>Geo</strong>${user.attributes.geo || '—'}</div>
        <div><strong>Manager</strong>${user.attributes.manager_email || '—'}</div>
        <div><strong>Skip-level</strong>${user.attributes.skip_level_email || '—'}</div>
        <div><strong>Last active</strong>${formatDate(user.activity_summary.last_active_date)}</div>
      </div>
    </div>
    <div class="detail-block">
      <canvas id="weeklyChart" height="120"></canvas>
    </div>
    <div class="detail-block">
      <h4>Dashboard activity</h4>
      <table class="table">
        <thead>
          <tr>
            <th>Dashboard</th>
            <th>Total views</th>
            <th>Unique views</th>
            <th>Last viewed</th>
          </tr>
        </thead>
        <tbody>
          ${dashboardRows || '<tr><td colspan="4">No dashboard data</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  const ctx = document.getElementById('weeklyChart');
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Logins',
          data: loginData,
          borderColor: '#e36414',
          backgroundColor: 'rgba(227, 100, 20, 0.15)',
          tension: 0.25
        },
        {
          label: 'Total views',
          data: totalViewsData,
          borderColor: '#1d3557',
          backgroundColor: 'rgba(29, 53, 87, 0.12)',
          tension: 0.25
        },
        {
          label: 'Unique views',
          data: uniqueViewsData,
          borderColor: '#2a9d8f',
          backgroundColor: 'rgba(42, 157, 143, 0.12)',
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 6 }
        }
      }
    }
  });
}

async function showDetail(entry) {
  if (!entry) return;
  if (state.userCache.has(entry.id)) {
    renderDetail(state.userCache.get(entry.id));
    return;
  }
  const response = await fetch(entry.path);
  const data = await response.json();
  state.userCache.set(entry.id, data);
  renderDetail(data);
}

function clearFilters() {
  state.filters = {};
  state.searchTerm = '';
  els.search.value = '';
  renderFilters();
  renderResults();
  updateURL();
}

async function init() {
  const [indexRes, facetRes, dashboardRes] = await Promise.all([
    fetch('/data/index.json'),
    fetch('/data/facets.json'),
    fetch('/data/dashboards.json')
  ]);
  state.index = await indexRes.json();
  state.facets = await facetRes.json();
  state.dashboards = await dashboardRes.json();
  state.dashboardUsers = new Map(
    state.dashboards.map((dash) => [dash.name, new Set(dash.users)])
  );

  state.miniSearch = new MiniSearch({
    fields: ['name', 'email', 'title', 'department'],
    storeFields: [
      'id',
      'email',
      'name',
      'department',
      'geo',
      'title',
      'manager_email',
      'skip_level_email',
      'segments',
      'activity_score',
      'activity_score_bucket',
      'login_total',
      'total_views',
      'unique_views',
      'last_active_date',
      'path'
    ]
  });
  state.miniSearch.addAll(state.index);

  applyQueryParams();
  renderDashboards();
  renderFilters();
  renderResults();
  renderView();
  updateURL();
}

els.search.addEventListener('input', (event) => {
  state.searchTerm = event.target.value.trim();
  renderResults();
  updateURL();
});

els.sort.addEventListener('change', (event) => {
  state.sortKey = event.target.value;
  renderResults();
  updateURL();
});

els.clear.addEventListener('click', clearFilters);
els.clearDashboard.addEventListener('click', () => {
  state.selectedDashboard = null;
  renderDashboards();
  renderResults();
  updateURL();
});

els.tabUsers.addEventListener('click', () => {
  state.view = 'users';
  renderView();
  updateURL();
});

els.tabBreakdown.addEventListener('click', () => {
  state.view = 'breakdown';
  renderView();
  updateURL();
});

els.compactToggle.addEventListener('change', (event) => {
  state.compact = event.target.checked;
  renderResults();
  updateURL();
});

els.dashboardInput.addEventListener('change', (event) => {
  const value = event.target.value.trim();
  const match = state.dashboards.find((dash) => dash.name === value);
  state.selectedDashboard = match ? match.name : null;
  renderDashboards();
  renderResults();
  updateURL();
});

init();
