const TOKEN_KEY = 'suppliersAdminToken';
const EMAIL_KEY = 'suppliersAdminEmail';

const $ = (selector) => document.querySelector(selector);

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setMessage(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = $('#tokenInput').value.trim().replace(/^Bearer\s+/i, '');
    const email = $('#emailInput').value.trim();
    if (!token) {
      setMessage('.form-note', 'Paste a bearer token before opening the dashboard.');
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
    window.location.href = '/admin/';
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
  timeline.innerHTML = imports.length ? imports.slice(0, 8).map((job) => `
    <article class="timeline-item">
      <span class="status ${statusClass(job.status)}">${job.status || 'pending'}</span>
      <strong>${job.triggerType || 'manual'} import</strong>
      <small>${formatDate(job.createdAt)} | payload ${job.payloadValidationStatus || 'pending'} | warehouse ${job.warehouseStockValidationStatus || 'pending'}</small>
    </article>
  `).join('') : '<p class="empty-note">No import jobs yet. Runs will appear here with validation and Warehouse boundary evidence.</p>';
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

  $('#logoutButton').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
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
