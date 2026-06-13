const TOKEN_KEY = 'suppliersAdminToken';
const EMAIL_KEY = 'suppliersAdminEmail';
const REFRESH_TOKEN_KEY = 'suppliersRefreshToken';
const AUTH_LOGIN_URL = window.SUPPLIERS_AUTH_LOGIN_URL || 'https://auth.alfares.cz/auth/login';

const $ = (selector) => document.querySelector(selector);

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setMessage(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}

function resolveAuthToken(body) {
  return body?.accessToken || body?.access_token || body?.token || body?.data?.accessToken || body?.data?.access_token;
}

function resolveAuthEmail(body, fallback) {
  return body?.user?.email || body?.data?.user?.email || fallback;
}

async function loginWithPassword(email, password) {
  const response = await fetch(AUTH_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Invalid email or password.');
  }

  const accessToken = resolveAuthToken(body);
  if (!accessToken) {
    throw new Error('Auth service did not return an access token.');
  }

  return {
    accessToken,
    refreshToken: body.refreshToken || body.refresh_token || body.data?.refreshToken || body.data?.refresh_token || '',
    email: resolveAuthEmail(body, email),
  };
}

async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('Authentication failed. Sign in with an authorized admin token.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with ${response.status}`);
  }

  return response.json();
}

function initLogin() {
  const form = $('#loginForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#emailInput').value.trim();
    const password = $('#passwordInput').value;
    const submitButton = form.querySelector('button[type="submit"]');

    if (!email || !password) {
      setMessage('.form-note', 'Enter email and password before opening the dashboard.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';
    setMessage('.form-note', 'Authenticating with Auth service...');

    try {
      const session = await loginWithPassword(email, password);
      localStorage.setItem(TOKEN_KEY, session.accessToken);
      localStorage.setItem(EMAIL_KEY, session.email);
      if (session.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
      window.location.href = '/admin/';
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setMessage('.form-note', error.message);
      submitButton.disabled = false;
      submitButton.textContent = 'Sign in and open dashboard';
    }
  });
}

function initRegister() {
  const form = $('#registerForm');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem('suppliersRegistrationInterest', JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString(),
    }));
    form.reset();
    setMessage('#registerResult', 'Registration request saved in this browser. The Auth service remains responsible for account creation.');
  });
}

function formatDate(value) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusClass(value) {
  const normalized = String(value || 'pending').toLowerCase();
  if (['completed', 'passed', 'active', 'done'].includes(normalized)) return 'good';
  if (['failed', 'blocked'].includes(normalized)) return 'bad';
  if (['running', 'pending'].includes(normalized)) return 'warn';
  return 'neutral';
}

function serviceLabel() {
  return 'Catalog, Warehouse, FlipFlop, Allegro, Orders';
}

function emptyRow() {
  return `<tr><td colspan="7" class="empty-cell">No suppliers are registered yet. Add a supplier when a real supplier contract and safe credential references are available.</td></tr>`;
}

function renderSuppliers(state) {
  const rows = $('#supplierRows');
  if (!rows) return;
  const query = ($('#supplierSearch')?.value || '').toLowerCase();
  const filtered = state.suppliers.filter((supplier) => {
    return [supplier.name, supplier.code, supplier.apiType].some((value) => String(value || '').toLowerCase().includes(query));
  });

  rows.innerHTML = filtered.length ? filtered.map((supplier) => {
    const latestJob = state.imports.find((job) => job.supplierId === supplier.id) || {};
    const mappingCount = state.mappings[supplier.id]?.length || 0;
    const mappingStatus = mappingCount > 0 ? `${mappingCount} mapped` : 'Needs mapping';
    return `
      <tr data-supplier-id="${supplier.id}">
        <td><button class="row-button" type="button">${supplier.name}<span>${supplier.code}</span></button></td>
        <td><span class="chip">${String(supplier.apiType || 'rest').toUpperCase()}</span></td>
        <td>${serviceLabel()}</td>
        <td><span class="status ${mappingCount > 0 ? 'good' : 'warn'}">${mappingStatus}</span></td>
        <td>${formatDate(supplier.lastSyncAt)}</td>
        <td><span class="status ${statusClass(latestJob.status || supplier.lastSyncStatus)}">${latestJob.status || supplier.lastSyncStatus || 'pending'}</span></td>
        <td><span class="status ${statusClass(latestJob.warehouseStockValidationStatus)}">${latestJob.warehouseStockValidationStatus || 'pending'}</span></td>
      </tr>
    `;
  }).join('') : emptyRow();

  rows.querySelectorAll('tr[data-supplier-id]').forEach((row) => {
    row.addEventListener('click', () => selectSupplier(state, row.dataset.supplierId));
  });
}

function renderImports(imports) {
  const timeline = $('#importTimeline');
  if (!timeline) return;
  timeline.innerHTML = imports.length ? imports.slice(0, 12).map((job) => `
    <article class="timeline-item">
      <span class="status ${statusClass(job.status)}">${job.status || 'pending'}</span>
      <strong>${job.triggerType || 'manual'} import</strong>
      <small>${formatDate(job.createdAt)} | payload ${job.payloadValidationStatus || 'pending'} | warehouse ${job.warehouseStockValidationStatus || 'pending'}</small>
    </article>
  `).join('') : '<p class="empty-note">No import jobs yet. Runs will appear here with validation and Warehouse boundary evidence.</p>';
}

function mappingTotal(state) {
  return Object.values(state.mappings).reduce((total, mappings) => total + mappings.length, 0);
}

function renderRoutePages(state) {
  const mappingMatrix = $('#mappingMatrix');
  if (mappingMatrix) {
    mappingMatrix.innerHTML = state.suppliers.length ? state.suppliers.map((supplier) => {
      const count = state.mappings[supplier.id]?.length || 0;
      return `
        <article class="route-card">
          <strong>${supplier.name}</strong>
          <span>${supplier.code} | ${count} category mapping${count === 1 ? '' : 's'}</span>
          <small class="status ${count > 0 ? 'good' : 'warn'}">${count > 0 ? 'Mapped to Catalog IDs' : 'Needs category mapping'}</small>
        </article>
      `;
    }).join('') : '<p class="empty-note">No suppliers are available for category mapping.</p>';
  }

  const catalogRoute = $('#catalogRoute');
  if (catalogRoute) {
    catalogRoute.innerHTML = `
      <article class="route-card"><strong>${mappingTotal(state)}</strong><span>Supplier category mappings currently loaded for Catalog routing.</span></article>
      <article class="route-card"><strong>Catalog owns taxonomy</strong><span>Suppliers stores only supplier category IDs and mapped Catalog category IDs.</span></article>
      <article class="route-card"><strong>${state.suppliers.length}</strong><span>Suppliers can feed product import validation before Catalog writes.</span></article>
    `;
  }

  const blocked = state.imports.filter((job) => ['failed', 'blocked'].includes(String(job.warehouseStockValidationStatus || job.status).toLowerCase())).length;
  const warehouseRoute = $('#warehouseRoute');
  if (warehouseRoute) {
    warehouseRoute.innerHTML = `
      <article class="route-card"><strong>${state.imports.length}</strong><span>Import jobs with Warehouse validation evidence.</span></article>
      <article class="route-card"><strong>${blocked}</strong><span>Blocked or failed Warehouse policy checks.</span></article>
      <article class="route-card"><strong>Warehouse owns stock</strong><span>Supplier imports must pass reconciliation before downstream mutation.</span></article>
    `;
  }

  const consumerRoutes = $('#consumerRoutes');
  if (consumerRoutes) {
    consumerRoutes.innerHTML = ['FlipFlop', 'Allegro', 'Orders', 'Logging'].map((name) => `
      <article class="route-card"><strong>${name}</strong><span>Consumes validated supplier import state through the controlled service boundary.</span></article>
    `).join('');
  }

  const alertList = $('#alertList');
  if (alertList) {
    const alerts = state.imports.filter((job) => ['failed', 'blocked'].includes(String(job.warehouseStockValidationStatus || job.status).toLowerCase()));
    alertList.innerHTML = alerts.length ? alerts.slice(0, 10).map((job) => `
      <article class="timeline-item">
        <span class="status bad">${job.warehouseStockValidationStatus || job.status}</span>
        <strong>${job.triggerType || 'manual'} import requires attention</strong>
        <small>${formatDate(job.createdAt)} | supplier ${job.supplierId || 'unknown'}</small>
      </article>
    `).join('') : '<p class="empty-note">No failed or blocked supplier checks are currently loaded.</p>';
  }
}

function selectSupplier(state, supplierId) {
  const supplier = state.suppliers.find((item) => item.id === supplierId);
  state.selectedSupplierId = supplierId;
  if (!supplier) return;
  $('#detailName').textContent = supplier.name;
  $('#detailCode').textContent = `${supplier.code} | ${String(supplier.apiType || '').toUpperCase()} | ${supplier.isActive ? 'active' : 'inactive'}`;
  $('#detailCredentials').textContent = supplier.hasCredentials ? 'Configured as safe runtime reference' : 'No credential reference';
  $('#runImportButton').disabled = false;
  document.querySelectorAll('#supplierRows tr').forEach((row) => row.classList.toggle('selected', row.dataset.supplierId === supplierId));
}

function renderKpis(state) {
  $('#kpiSuppliers').textContent = state.suppliers.length;
  $('#kpiActive').textContent = state.suppliers.filter((supplier) => supplier.isActive).length;
  $('#kpiImports').textContent = state.imports.length;
  $('#kpiBlocked').textContent = state.imports.filter((job) => ['failed', 'blocked'].includes(String(job.warehouseStockValidationStatus || job.status).toLowerCase())).length;
  renderRoutePages(state);
}

const ADMIN_ROUTES = {
  dashboard: { path: '/admin/', title: 'Supplier control dashboard', description: 'All supplier connections, validation jobs, category mappings, and downstream service routes.' },
  suppliers: { path: '/admin/suppliers/', title: 'Suppliers', description: 'Supplier registry, connection metadata, credentials status, and manual import actions.' },
  imports: { path: '/admin/imports/', title: 'Imports', description: 'Import runs, validation status, and Warehouse boundary evidence.' },
  mappings: { path: '/admin/mappings/', title: 'Mappings', description: 'Supplier category mapping coverage for Catalog routing.' },
  catalog: { path: '/admin/catalog/', title: 'Catalog route', description: 'Supplier data that is safe to hand off to Catalog after validation and mapping.' },
  warehouse: { path: '/admin/warehouse/', title: 'Warehouse route', description: 'Stock reconciliation evidence and Warehouse mutation boundaries.' },
  consumers: { path: '/admin/consumers/', title: 'Consumers', description: 'Validated downstream routes for marketplace, order, and logging consumers.' },
  alerts: { path: '/admin/alerts/', title: 'Alerts', description: 'Failed or blocked supplier checks that need operator attention.' },
  settings: { path: '/admin/settings/', title: 'Settings', description: 'Admin access, credential safety, and service boundary configuration.' },
};

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '/') || '/admin/';
  const found = Object.entries(ADMIN_ROUTES).find(([, route]) => route.path === path);
  return found ? found[0] : 'dashboard';
}

function setAdminRoute(routeName, options = {}) {
  const route = ADMIN_ROUTES[routeName] ? routeName : 'dashboard';
  const config = ADMIN_ROUTES[route];
  document.querySelectorAll('[data-route-view]').forEach((element) => {
    const views = (element.dataset.routeView || '').split(/\s+/);
    element.hidden = !views.includes(route);
  });
  document.querySelectorAll('.admin-nav a[data-route]').forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = $('.admin-topbar h1');
  const description = $('.admin-topbar p');
  if (title) title.textContent = config.title;
  if (description) description.textContent = config.description;
  const search = $('#supplierSearch');
  if (search) search.hidden = !['dashboard', 'suppliers'].includes(route);
  if (!options.skipHistory && window.location.pathname !== config.path) {
    window.history.pushState({ route }, '', config.path);
  }
}

async function loadDashboard(state) {
  const [suppliersResponse, importsResponse] = await Promise.all([
    api('/api/suppliers'),
    api('/api/imports'),
  ]);
  state.suppliers = suppliersResponse.data || [];
  state.imports = importsResponse.data || [];
  state.mappings = {};

  await Promise.all(state.suppliers.map(async (supplier) => {
    try {
      const response = await api(`/api/mappings/supplier/${supplier.id}`);
      state.mappings[supplier.id] = response.data || [];
    } catch {
      state.mappings[supplier.id] = [];
    }
  }));

  renderKpis(state);
  renderSuppliers(state);
  renderImports(state.imports);
  if (state.suppliers[0]) selectSupplier(state, state.suppliers[0].id);
  setAdminRoute(routeFromLocation(), { skipHistory: true });
}

function initAdmin() {
  const shell = $('#dashboardContent');
  if (!shell) return;
  const gate = $('#authGate');
  const state = { suppliers: [], imports: [], mappings: {}, selectedSupplierId: null };

  $('#adminIdentity').textContent = localStorage.getItem(EMAIL_KEY) || 'Supplier admin';

  if (!getToken()) {
    shell.hidden = true;
    gate.hidden = false;
    return;
  }

  setAdminRoute(routeFromLocation(), { skipHistory: true });
  document.querySelectorAll('.admin-nav a[data-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setAdminRoute(link.dataset.route);
    });
  });
  document.querySelectorAll('[data-route-button]').forEach((button) => {
    button.addEventListener('click', () => setAdminRoute(button.dataset.routeButton));
  });
  window.addEventListener('popstate', () => setAdminRoute(routeFromLocation(), { skipHistory: true }));

  $('#logoutButton').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = '/login/';
  });
  $('#refreshButton').addEventListener('click', () => loadDashboard(state).catch((error) => setMessage('#actionResult', error.message)));
  $('#supplierSearch').addEventListener('input', () => renderSuppliers(state));
  $('#toggleCreateSupplier').addEventListener('click', () => {
    const form = $('#createSupplierForm');
    form.hidden = !form.hidden;
  });
  $('#runImportButton').addEventListener('click', async () => {
    if (!state.selectedSupplierId) return;
    try {
      const response = await api(`/api/imports/run/${state.selectedSupplierId}`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'manual' }),
      });
      setMessage('#actionResult', `Import job ${response.data.id} accepted.`);
      await loadDashboard(state);
    } catch (error) {
      setMessage('#actionResult', error.message);
    }
  });
  $('#createSupplierForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.isActive = true;
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') delete payload[key];
    });
    try {
      await api('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      setMessage('#actionResult', 'Supplier created without raw credential values.');
      await loadDashboard(state);
    } catch (error) {
      setMessage('#actionResult', error.message);
    }
  });

  loadDashboard(state).catch((error) => {
    shell.hidden = true;
    gate.hidden = false;
    gate.querySelector('p').textContent = error.message;
  });
}

initLogin();
initRegister();
initAdmin();
