/* ═══════════════════════════════════════════
   app.js — Application Controller
   Handles uploads, state, tab navigation,
   generate flow, demo data, and AI drawer.
═══════════════════════════════════════════ */

// ── App State ──────────────────────────────────────────
const AppState = {
  apiConnected: false,
  files: { tb: [], bank: [], ar: [], debt: [], cc: [], other: [] },
  model: null,
  company: '',
  period: '',
  tbCsvText: null,
  tbHeaders: [],
};

// ── Page Navigation ────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Tab Navigation ─────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');

  if (name === 'dashboard' && AppState.model) {
    // Charts re-render on tab switch via renderer
  }
}

// ── API Key ────────────────────────────────────────────
function connectAPI() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key.startsWith('sk-ant-')) {
    alert('Invalid API key format. Keys begin with sk-ant-...');
    return;
  }
  AI.setKey(key);
  AppState.apiConnected = true;
  sessionStorage.setItem('fs_api_key', key);

  document.getElementById('api-status').innerHTML =
    '<span class="status-dot connected"></span><span class="status-text">API Connected</span>';

  document.getElementById('api-setup-card').style.opacity = '0.5';
  document.getElementById('api-setup-card').style.pointerEvents = 'none';

  checkGenerateReady();
}

// ── Upload Handlers ────────────────────────────────────
function triggerUpload(inputId) {
  document.getElementById(inputId).click();
}

function dragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('drag-over');
}

function dragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove('drag-over');
}

function dropFile(e, zoneId, type) {
  e.preventDefault();
  dragLeave(zoneId);
  const files = e.dataTransfer.files;
  if (files.length) processFiles(Array.from(files), type);
}

function fileSelected(input, type) {
  if (input.files.length) processFiles(Array.from(input.files), type);
}

function processFiles(files, type) {
  AppState.files[type].push(...files);
  renderFileLists();

  // If it's a trial balance, read and detect columns
  if (type === 'tb' && files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      AppState.tbCsvText = e.target.result;
      AppState.tbHeaders = Parser.getColumnOptions(AppState.tbCsvText);
      renderMappingGrid(AppState.tbHeaders);
      document.getElementById('zone-tb').classList.add('has-files');
    };
    reader.readAsText(files[0]);
  }

  checkGenerateReady();
}

function renderFileLists() {
  const container = document.getElementById('file-lists');
  const typeLabels = {
    tb: 'Trial Balance', bank: 'Bank Statements', ar: 'AR / AP Aging',
    debt: 'Debt Schedules', cc: 'Credit Card Statements', other: 'Other Schedules',
  };

  let html = '';
  for (const [type, files] of Object.entries(AppState.files)) {
    if (!files.length) continue;
    html += `<div class="file-section-title">${typeLabels[type]}</div>`;
    html += files.map((f, i) => `
      <div class="file-item">
        <div class="file-doc-icon">${getFileIcon(f.name)}</div>
        <span class="file-name">${f.name}</span>
        <span class="file-size">${formatBytes(f.size)}</span>
        <span class="file-type-badge">${f.name.split('.').pop().toUpperCase()}</span>
        <button class="file-remove" onclick="removeFile('${type}', ${i})">×</button>
      </div>`).join('');
  }
  container.innerHTML = html;
}

function removeFile(type, idx) {
  AppState.files[type].splice(idx, 1);
  if (type === 'tb' && !AppState.files.tb.length) {
    AppState.tbCsvText = null;
    AppState.tbHeaders = [];
    document.getElementById('zone-tb').classList.remove('has-files');
    document.getElementById('mapping-section').style.display = 'none';
    document.getElementById('mapping-grid').style.display = 'none';
  }
  renderFileLists();
  checkGenerateReady();
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['xlsx','xls'].includes(ext)) return '📊';
  if (ext === 'csv') return '📋';
  return '📎';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function renderMappingGrid(headers) {
  document.getElementById('mapping-section').style.display = '';
  document.getElementById('mapping-grid').style.display = '';

  const fields = [
    { id: 'map-name',    label: 'Account Name Column', hint: ['account name','description','gl account','name'] },
    { id: 'map-code',    label: 'Account Code',        hint: ['account no','code','number','id','acct'] },
    { id: 'map-balance', label: 'Balance Column',      hint: ['balance','amount','net','total','ytd'] },
  ];

  const detectDefault = (hints) => {
    for (const h of headers) {
      for (const hint of hints) {
        if (h.toLowerCase().includes(hint)) return h;
      }
    }
    return headers[0] || '';
  };

  const opts = (selected) => headers.map(h =>
    `<option value="${h}" ${h === selected ? 'selected' : ''}>${h}</option>`
  ).join('');

  document.getElementById('mapping-grid').innerHTML = fields.map(f => `
    <div class="map-field">
      <label>${f.label}</label>
      <select id="${f.id}">${opts(detectDefault(f.hint))}</select>
    </div>`).join('');
}

function checkGenerateReady() {
  const hasAPI  = AppState.apiConnected;
  const hasTB   = AppState.files.tb.length > 0 || AppState.tbCsvText;
  const btn = document.getElementById('btn-generate');

  // Can generate if we have a TB, with or without API (demo mode)
  btn.disabled = !hasTB;
  btn.title = !hasTB ? 'Upload a trial balance to continue' : '';
}

// ── Generate Model ─────────────────────────────────────
async function generateModel() {
  const company = document.getElementById('company-name').value.trim() || 'Company';
  const period  = document.getElementById('reporting-period').value.trim() || 'Reporting Period';
  const currency = document.getElementById('currency').value;
  const scale    = document.getElementById('scale').value;

  AppState.company = company;
  AppState.period  = period;

  showProgress(true);
  setProgress(5, 'Reading uploaded documents...');
  addProgressStep('Files received');

  await sleep(300);
  setProgress(20, 'Parsing trial balance...');

  try {
    let csvText = AppState.tbCsvText;
    if (!csvText) {
      throw new Error('No trial balance data. Please upload a CSV file or load demo data.');
    }

    const colMap = AppState.tbHeaders.length ? {
      accountName: { name: document.getElementById('map-name')?.value || AppState.tbHeaders[0] },
      accountCode: { name: document.getElementById('map-code')?.value || AppState.tbHeaders[1] },
      balance:     { name: document.getElementById('map-balance')?.value || AppState.tbHeaders[2] },
    } : null;

    const { accounts, rowCount, skippedRows } = Parser.parseTrialBalance(csvText, colMap);
    addProgressStep(`Parsed ${rowCount} accounts (${skippedRows} skipped)`);

    await sleep(200);
    setProgress(45, 'Classifying GL accounts...');

    const model = Parser.buildModel(accounts, scale, currency);
    AppState.model = model;
    addProgressStep(`Classified into ${Object.keys({revenue:1,cogs:1,sga:1}).length}+ statement categories`);

    await sleep(200);
    setProgress(65, 'Building three-statement model...');

    Renderer.renderIncomeStatement(model, period, company);
    Renderer.renderBalanceSheet(model, period, company);
    Renderer.renderCashFlow(model, period, company);
    addProgressStep('Income Statement, Balance Sheet, Cash Flow generated');

    await sleep(200);
    setProgress(85, 'Rendering Executive Dashboard...');

    Renderer.renderDashboard(model, period, company);
    addProgressStep('Executive Dashboard and charts rendered');

    await sleep(200);
    setProgress(100, 'Model complete.');
    addProgressStep('✓ Three-Statement Model ready');

    // Update header
    AI.setContext(model, company, period);
    document.getElementById('company-name-display').textContent = company;
    document.getElementById('period-badge').textContent = period;
    document.getElementById('company-display').style.display = 'flex';

    await sleep(600);
    showProgress(false);
    switchTab('income', document.querySelector('[data-tab="income"]'));

  } catch (err) {
    showProgress(false);
    alert('Error generating model: ' + err.message);
    console.error(err);
  }
}

function showProgress(show) {
  const panel = document.getElementById('progress-panel');
  panel.style.display = show ? 'block' : 'none';
  if (show) document.getElementById('progress-steps').innerHTML = '';
}

function setProgress(pct, label) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = label;
}

function addProgressStep(text) {
  const div = document.createElement('div');
  div.className = 'progress-step done';
  div.textContent = text;
  document.getElementById('progress-steps').appendChild(div);
}

// ── Demo Data ──────────────────────────────────────────
function loadDemoData() {
  const demo = generateDemoCSV();
  AppState.tbCsvText = demo;
  AppState.tbHeaders = Parser.getColumnOptions(demo);

  document.getElementById('company-name').value = 'Kellermeyer Bergensons Services';
  document.getElementById('reporting-period').value = 'FY 2024';
  document.getElementById('currency').value = 'USD';
  document.getElementById('scale').value = '1000';

  // Create a virtual file entry
  AppState.files.tb = [{ name: 'KBS_TrialBalance_FY2024_Demo.csv', size: demo.length }];
  document.getElementById('zone-tb').classList.add('has-files');
  renderFileLists();
  renderMappingGrid(AppState.tbHeaders);
  checkGenerateReady();

  alert('Demo data loaded — KBS FY2024 Trial Balance (fictitious). Click "Generate Financial Model" to proceed.');
}

function generateDemoCSV() {
  const rows = [
    ['Account No.', 'Account Name', 'Net Balance'],
    // Revenue
    ['4000', 'Janitorial & Facility Services Revenue', '-198420000'],
    ['4100', 'Specialty Cleaning Revenue', '-52310000'],
    ['4200', 'Landscaping & Grounds Revenue', '-19680000'],
    ['4300', 'Other Service Revenue', '-14290000'],
    // COGS
    ['5000', 'Direct Labor - Field Operations', '176890000'],
    ['5100', 'Supplies & Materials', '22140000'],
    ['5200', 'Subcontractor Costs', '18640000'],
    ['5300', 'Other Direct Costs', '5630000'],
    // SGA
    ['6000', 'Compensation & Benefits - G&A', '18200000'],
    ['6100', 'Occupancy & Facilities', '3840000'],
    ['6200', 'Technology & Systems', '2190000'],
    ['6300', 'Sales & Marketing', '4410000'],
    ['6400', 'Professional Fees', '2100000'],
    ['6500', 'Travel & Meals', '890000'],
    ['6600', 'Depreciation & Amortization', '5810000'],
    ['6700', 'Other G&A Expense', '670000'],
    // Interest / Tax
    ['7500', 'Interest Expense - Term Loan', '8640000'],
    ['8000', 'Income Tax Expense', '3170000'],
    // Balance Sheet - Assets
    ['1000', 'Cash & Checking Accounts', '14820000'],
    ['1100', 'Accounts Receivable', '38610000'],
    ['1150', 'Unbilled Revenue (WIP)', '8240000'],
    ['1200', 'Prepaid Expenses', '2100000'],
    ['1210', 'Other Current Assets', '1870000'],
    ['1500', 'Property, Plant & Equipment', '48210000'],
    ['1700', 'Goodwill', '19860000'],
    ['1750', 'Intangible Assets - Customer Relationships', '62100000'],
    ['1900', 'Other Long-Term Assets', '2590000'],
    // Balance Sheet - Liabilities
    ['2000', 'Accounts Payable', '22410000'],
    ['2100', 'Accrued Wages & Benefits', '9200000'],
    ['2150', 'Accrued Liabilities - Other', '5620000'],
    ['2300', 'Current Portion of Long-Term Debt', '10110000'],
    ['2500', 'Long-Term Debt - Term Loan B', '98420000'],
    ['2700', 'Deferred Tax Liability', '4210000'],
    ['2750', 'Other Long-Term Liabilities', '6540000'],
    // Equity
    ['3000', 'Common Stock & APIC', '18000000'],
    ['3100', 'Retained Earnings', '23890000'],
  ];
  return rows.map(r => r.join(',')).join('\n');
}

// ── Export ─────────────────────────────────────────────
function exportStatement(type) {
  if (!AppState.model) { alert('Generate a model first.'); return; }
  const model = AppState.model;
  const is = model.incomeStatement;
  const bs = model.balanceSheet;
  const cf = model.cashFlow;
  const fmt = Parser.fmt;

  let rows = [];
  if (type === 'income') {
    rows = [
      ['Income Statement', AppState.company, AppState.period],
      [''],
      ['Line Item', 'Amount'],
      ['Total Revenue', is.revenue.total],
      ['Total COGS', -is.cogs.total],
      ['Gross Profit', is.grossProfit],
      ['Gross Margin %', (is.grossMargin * 100).toFixed(1) + '%'],
      ['Total SG&A', -is.sga.total],
      ['EBIT', is.ebit],
      ['EBITDA', is.ebitda],
      ['Interest Expense', -is.interestExpense],
      ['Tax Expense', -is.taxExpense],
      ['Net Income', is.netIncome],
      ['Net Margin %', (is.netMargin * 100).toFixed(1) + '%'],
    ];
  } else if (type === 'balance') {
    rows = [
      ['Balance Sheet', AppState.company, AppState.period],
      [''],
      ['Assets', ''],
      ['Cash', bs.assets.cash],
      ['Accounts Receivable', bs.assets.ar],
      ['Other Current Assets', bs.assets.otherCA],
      ['Total Current Assets', bs.assets.totalCurrentAssets],
      ['PP&E', bs.assets.ppe],
      ['Intangibles & Goodwill', bs.assets.intangibles],
      ['Total Assets', bs.assets.totalAssets],
      [''],
      ['Liabilities & Equity', ''],
      ['Accounts Payable', bs.liabilities.ap],
      ['Accrued Liabilities', bs.liabilities.accrued],
      ['Total Current Liabilities', bs.liabilities.totalCurrentLiab],
      ['Long-Term Debt', bs.liabilities.ltDebt],
      ['Total Non-Current Liabilities', bs.liabilities.totalNonCurrentLiab],
      ['Total Equity', bs.liabilities.equityVal],
      ['Total Liabilities & Equity', bs.liabilities.totalLiabEquity],
    ];
  } else if (type === 'cashflow') {
    rows = [
      ['Cash Flow Statement', AppState.company, AppState.period],
      [''],
      ['Operating Activities', ''],
      ['Net Income', cf.netIncome],
      ['D&A Add-back', cf.da],
      ['Net Cash from Operations', cf.operatingCF],
      [''],
      ['Investing Activities', ''],
      ['Capital Expenditures', cf.capex],
      ['Net Cash from Investing', cf.capex],
      [''],
      ['Financing Activities', ''],
      ['Debt Repayment', cf.debtRepayment],
      ['Net Cash from Financing', cf.financingCF],
      [''],
      ['Net Change in Cash', cf.netCashChange],
      ['Free Cash Flow', cf.fcf],
    ];
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  downloadFile(csv, `${AppState.company.replace(/\s/g,'_')}_${type}_${AppState.period.replace(/\s/g,'_')}.csv`, 'text/csv');
}

function exportAll() {
  exportStatement('income');
  setTimeout(() => exportStatement('balance'), 300);
  setTimeout(() => exportStatement('cashflow'), 600);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── AI Chat Drawer ─────────────────────────────────────
function askAI(type) {
  if (!AppState.model) { alert('Generate a financial model first.'); return; }
  if (!AppState.apiConnected) { alert('Please connect your Anthropic API key first.'); return; }

  openDrawer();
  const prompt = AI.getPrompt(type);
  sendMessage(prompt, true);
}

function openDrawer() {
  document.getElementById('ai-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('show');
}

function closeDrawer() {
  document.getElementById('ai-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
}

function sendFollowUp() {
  const input = document.getElementById('drawer-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text, false);
}

async function sendMessage(text, isSystem) {
  const msgs = document.getElementById('drawer-messages');

  if (!isSystem) {
    const userMsg = document.createElement('div');
    userMsg.className = 'msg msg-user';
    userMsg.textContent = text;
    msgs.appendChild(userMsg);
  }

  const aiMsg = document.createElement('div');
  aiMsg.className = 'msg msg-ai msg-loading';
  aiMsg.innerHTML = '<em>Analyzing...</em>';
  msgs.appendChild(aiMsg);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    let fullText = '';
    aiMsg.className = 'msg msg-ai';
    aiMsg.innerHTML = '';

    await AI.callAPI(text, (chunk) => {
      fullText += chunk;
      // Render with basic bold support
      aiMsg.innerHTML = fullText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      msgs.scrollTop = msgs.scrollHeight;
    });

    // If it's a full analysis, also update the dashboard executive summary
    if (text.includes('executive narrative') || text.includes('full')) {
      const execText = document.getElementById('exec-text');
      if (execText) {
        document.querySelector('#exec-summary .analysis-tag').textContent = '◆ Executive Summary · AI-Generated';
        execText.innerHTML = fullText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
      }
    }

  } catch (err) {
    aiMsg.className = 'msg msg-ai';
    aiMsg.innerHTML = `<span style="color:#fca5a5;">Error: ${err.message}</span>`;
  }

  msgs.scrollTop = msgs.scrollHeight;
}

// ── Utilities ──────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore API key if previously set in session
  const savedKey = sessionStorage.getItem('fs_api_key');
  if (savedKey) {
    document.getElementById('api-key-input').value = savedKey;
    connectAPI();
  }
  checkGenerateReady();
});
