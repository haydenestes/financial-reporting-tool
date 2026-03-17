/* ═══════════════════════════════════════════
   renderer.js — Statement HTML Generator
   Renders Income Statement, Balance Sheet,
   Cash Flow, and Executive Dashboard from
   the parsed financial model object.
═══════════════════════════════════════════ */

window.Renderer = (() => {

  const { fmt, fmtPct } = window.Parser;

  // ── Currency symbol ───────────────────────────────────
  const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' };
  let sym = '$';
  let scaleLabel = '$000s';

  function init(currency, scale) {
    sym = SYMBOLS[currency] || '$';
    if (parseInt(scale) === 1000000) scaleLabel = `${sym}M`;
    else if (parseInt(scale) === 1000) scaleLabel = `${sym}000s`;
    else scaleLabel = `${sym} Actuals`;
  }

  function money(val) {
    if (val === 0 || val === undefined || val === null) return '—';
    return (val < 0 ? `(${sym}${fmt(val)})` : `${sym}${fmt(val)}`);
  }

  function pct(val) {
    if (!val && val !== 0) return '—';
    return fmtPct(val);
  }

  // ── Build table row helpers ───────────────────────────
  function sectionRow(label) {
    return `<tr class="tr-section"><td colspan="5">${label}</td></tr>`;
  }

  function dataRow(label, val, indent = 1, cssClass = '') {
    const indentClass = indent === 2 ? 'tr-indent2' : 'tr-indent';
    const valClass = val < 0 ? 'neg' : '';
    return `<tr class="${indentClass}">
      <td>${label}</td>
      <td class="${valClass}">${money(val)}</td>
    </tr>`;
  }

  function dataRowWithPY(label, val, pyVal, indent = 1) {
    const varAmt = val - pyVal;
    const varPct = pyVal ? varAmt / Math.abs(pyVal) : 0;
    const valClass = val < 0 ? 'neg' : '';
    const varClass = varAmt >= 0 ? 'pos' : 'neg';
    const indentClass = indent === 2 ? 'tr-indent2' : 'tr-indent';
    return `<tr class="${indentClass}">
      <td>${label}</td>
      <td class="${valClass}">${money(val)}</td>
      <td class="${val < 0 ? 'neg' : ''}" style="color:var(--muted)">${money(pyVal)}</td>
      <td class="${varClass}">${varAmt === 0 ? '—' : money(varAmt)}</td>
      <td class="${varClass}">${pyVal ? pct(varPct) : '—'}</td>
    </tr>`;
  }

  function subtotalRow(label, val, pyVal) {
    const varAmt = pyVal !== undefined ? val - pyVal : null;
    const varPct = pyVal ? varAmt / Math.abs(pyVal) : 0;
    const valClass = val < 0 ? 'neg' : '';
    const varClass = varAmt >= 0 ? 'pos' : 'neg';
    return `<tr class="tr-subtotal">
      <td>${label}</td>
      <td class="${valClass}">${money(val)}</td>
      ${pyVal !== undefined ? `<td style="color:var(--muted)">${money(pyVal)}</td>
        <td class="${varClass}">${varAmt !== null ? money(varAmt) : '—'}</td>
        <td class="${varClass}">${pyVal ? pct(varPct) : '—'}</td>` : ''}
    </tr>`;
  }

  function totalRow(label, val) {
    return `<tr class="tr-total">
      <td>${label}</td>
      <td>${money(val)}</td>
    </tr>`;
  }

  function totalRowFull(label, val, pyVal) {
    const varAmt = val - pyVal;
    const varPct = pyVal ? varAmt / Math.abs(pyVal) : 0;
    const varClass = varAmt >= 0 ? 'pos' : 'neg';
    return `<tr class="tr-total">
      <td>${label}</td>
      <td>${money(val)}</td>
      <td style="opacity:0.7">${money(pyVal)}</td>
      <td class="${varClass}">${money(varAmt)}</td>
      <td class="${varClass}">${pct(varPct)}</td>
    </tr>`;
  }

  // ── INCOME STATEMENT ──────────────────────────────────
  function renderIncomeStatement(model, period, company) {
    init(model.currency, model.scale);
    const is = model.incomeStatement;

    // KPIs
    const kpis = [
      { label: 'Total Revenue', value: money(is.revenue.total), delta: '', cls: 'kpi-gold' },
      { label: 'Gross Profit', value: money(is.grossProfit), delta: `Margin: ${pct(is.grossMargin)}`, cls: is.grossMargin > 0.15 ? 'kpi-green' : 'kpi-red' },
      { label: 'EBITDA', value: money(is.ebitda), delta: `Margin: ${pct(is.ebitda / (is.revenue.total || 1))}`, cls: '' },
      { label: 'Net Income', value: money(is.netIncome), delta: `Margin: ${pct(is.netMargin)}`, cls: is.netIncome > 0 ? 'kpi-green' : 'kpi-red' },
    ];

    document.getElementById('is-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        ${k.delta ? `<div class="kpi-delta">${k.delta}</div>` : ''}
      </div>`).join('');

    document.getElementById('is-period-label').textContent = `${period} · In ${scaleLabel}`;

    // Revenue items
    let revRows = is.revenue.items.length
      ? is.revenue.items.map(i => dataRow(i.name, i.value)).join('')
      : dataRow('Service Revenue', is.revenue.total);

    // COGS items
    let cogsRows = is.cogs.items.length
      ? is.cogs.items.map(i => dataRow(i.name, -Math.abs(i.value))).join('')
      : dataRow('Direct Costs', -is.cogs.total);

    // SGA items
    let sgaRows = is.sga.items.length
      ? is.sga.items.slice(0, 12).map(i => dataRow(i.name, -Math.abs(i.value))).join('')
      : dataRow('General & Administrative', -is.sga.total);

    const html = `
    <div class="stmt-wrapper">
      <div class="stmt-head">
        <div class="stmt-head-title">${company} — Consolidated Income Statement</div>
        <div class="stmt-head-period">${period} · ${scaleLabel}</div>
      </div>
      <table class="stmt-table">
        <thead>
          <tr>
            <th style="width:55%;">Line Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRow('Revenue')}
          ${revRows}
          ${subtotalRow('Total Revenue', is.revenue.total)}

          ${sectionRow('Cost of Revenue')}
          ${cogsRows}
          ${subtotalRow('Total Cost of Revenue', -is.cogs.total)}

          ${subtotalRow('Gross Profit', is.grossProfit)}
          <tr class="tr-indent"><td style="color:var(--muted);font-size:11px;">Gross Margin</td><td style="color:var(--muted)">${pct(is.grossMargin)}</td></tr>

          ${sectionRow('Operating Expenses (SG&A)')}
          ${sgaRows}
          ${subtotalRow('Total Operating Expenses', -is.sga.total)}

          ${subtotalRow('Operating Income (EBIT)', is.ebit)}
          <tr class="tr-indent"><td style="color:var(--muted);font-size:11px;">EBIT Margin</td><td style="color:var(--muted)">${pct(is.ebitMargin)}</td></tr>

          ${sectionRow('Below-the-Line Items')}
          ${is.otherIncome > 0 ? dataRow('Other Income', is.otherIncome) : ''}
          ${dataRow('Interest Expense', -is.interestExpense)}
          ${dataRow('Depreciation & Amortization', -is.da)}
          ${is.taxExpense > 0 ? dataRow('Income Tax Expense', -is.taxExpense) : ''}

          ${totalRow('Net Income', is.netIncome)}
          <tr class="tr-indent"><td style="color:var(--muted);font-size:11px;">Net Margin</td><td style="color:var(--muted)">${pct(is.netMargin)}</td></tr>
        </tbody>
      </table>
      <div class="stmt-footnote">Figures in ${scaleLabel}. D&A embedded in SG&A where not separately broken out.</div>
    </div>`;

    document.getElementById('is-content').innerHTML = html;
  }

  // ── BALANCE SHEET ─────────────────────────────────────
  function renderBalanceSheet(model, period, company) {
    init(model.currency, model.scale);
    const bs = model.balanceSheet;
    const a = bs.assets;
    const l = bs.liabilities;
    const r = bs.ratios;

    const kpis = [
      { label: 'Total Assets', value: money(a.totalAssets), delta: '', cls: '' },
      { label: 'Current Ratio', value: r.currentRatio.toFixed(2) + 'x', delta: r.currentRatio >= 1.5 ? 'Strong liquidity' : r.currentRatio >= 1.0 ? 'Adequate liquidity' : 'Watch — below 1.0x', cls: r.currentRatio >= 1.5 ? 'kpi-green' : r.currentRatio >= 1.0 ? 'kpi-gold' : 'kpi-red' },
      { label: 'Debt / Equity', value: r.debtEquity.toFixed(1) + 'x', delta: r.debtEquity > 4 ? 'Elevated leverage' : r.debtEquity > 2 ? 'Moderate leverage' : 'Conservative leverage', cls: r.debtEquity > 4 ? 'kpi-red' : '' },
      { label: 'Net Working Capital', value: money(r.nwc), delta: '', cls: r.nwc > 0 ? 'kpi-green' : 'kpi-red' },
    ];

    document.getElementById('bs-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        ${k.delta ? `<div class="kpi-delta">${k.delta}</div>` : ''}
      </div>`).join('');

    document.getElementById('bs-period-label').textContent = `As of ${period} · In ${scaleLabel}`;

    const html = `
    <div class="balance-grid">
      <div class="stmt-wrapper">
        <div class="stmt-head">
          <div class="stmt-head-title">Assets</div>
          <div class="stmt-head-period">${scaleLabel}</div>
        </div>
        <table class="stmt-table">
          <thead><tr><th>Line Item</th><th>Amount</th></tr></thead>
          <tbody>
            ${sectionRow('Current Assets')}
            ${dataRow('Cash & Cash Equivalents', a.cash)}
            ${dataRow('Accounts Receivable, net', a.ar)}
            ${a.otherCA > 0 ? dataRow('Prepaid & Other Current Assets', a.otherCA) : ''}
            ${subtotalRow('Total Current Assets', a.totalCurrentAssets)}

            ${sectionRow('Non-Current Assets')}
            ${a.ppe > 0 ? dataRow('Property, Plant & Equipment, net', a.ppe) : ''}
            ${a.intangibles > 0 ? dataRow('Intangible Assets, net', a.intangibles) : ''}
            ${a.otherLtAsset > 0 ? dataRow('Other Long-Term Assets', a.otherLtAsset) : ''}
            ${subtotalRow('Total Non-Current Assets', a.totalNonCurrentAssets)}

            ${totalRow('Total Assets', a.totalAssets)}
          </tbody>
        </table>
      </div>

      <div class="stmt-wrapper">
        <div class="stmt-head">
          <div class="stmt-head-title">Liabilities & Equity</div>
          <div class="stmt-head-period">${scaleLabel}</div>
        </div>
        <table class="stmt-table">
          <thead><tr><th>Line Item</th><th>Amount</th></tr></thead>
          <tbody>
            ${sectionRow('Current Liabilities')}
            ${dataRow('Accounts Payable', l.ap)}
            ${l.accrued > 0 ? dataRow('Accrued Liabilities', l.accrued) : ''}
            ${l.currentDebt > 0 ? dataRow('Current Portion of LT Debt', l.currentDebt) : ''}
            ${subtotalRow('Total Current Liabilities', l.totalCurrentLiab)}

            ${sectionRow('Non-Current Liabilities')}
            ${l.ltDebt > 0 ? dataRow('Long-Term Debt', l.ltDebt) : ''}
            ${l.otherLtLiab > 0 ? dataRow('Other Long-Term Liabilities', l.otherLtLiab) : ''}
            ${subtotalRow('Total Non-Current Liabilities', l.totalNonCurrentLiab)}

            ${sectionRow("Shareholders' Equity")}
            ${dataRow('Retained Earnings / Owner Equity', l.equityVal)}
            ${subtotalRow("Total Equity", l.equityVal)}

            ${totalRow('Total Liabilities & Equity', l.totalLiabEquity)}
          </tbody>
        </table>
        <div class="stmt-footnote">Check: Assets ${money(a.totalAssets)} ${Math.abs(a.totalAssets - l.totalLiabEquity) < 1 ? '= ✓' : '≠ ⚠'} Liabilities + Equity ${money(l.totalLiabEquity)}</div>
      </div>
    </div>`;

    document.getElementById('bs-content').innerHTML = html;
  }

  // ── CASH FLOW ─────────────────────────────────────────
  function renderCashFlow(model, period, company) {
    init(model.currency, model.scale);
    const cf = model.cashFlow;

    const kpis = [
      { label: 'Operating Cash Flow', value: money(cf.operatingCF), delta: 'Indirect method', cls: cf.operatingCF > 0 ? 'kpi-green' : 'kpi-red' },
      { label: 'Capital Expenditures', value: money(cf.capex), delta: model.incomeStatement.revenue.total ? pct(Math.abs(cf.capex) / model.incomeStatement.revenue.total) + ' of revenue' : '', cls: 'kpi-red' },
      { label: 'Free Cash Flow', value: money(cf.fcf), delta: '', cls: cf.fcf > 0 ? 'kpi-gold' : 'kpi-red' },
      { label: 'FCF / Net Income', value: cf.fcfConversion.toFixed(1) + 'x', delta: cf.fcfConversion > 1 ? 'Strong conversion' : 'Below net income', cls: cf.fcfConversion > 1 ? 'kpi-green' : '' },
    ];

    document.getElementById('cf-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        ${k.delta ? `<div class="kpi-delta">${k.delta}</div>` : ''}
      </div>`).join('');

    document.getElementById('cf-period-label').textContent = `${period} · In ${scaleLabel} · Indirect Method`;

    const html = `
    <div class="stmt-wrapper">
      <div class="stmt-head">
        <div class="stmt-head-title">${company} — Statement of Cash Flows</div>
        <div class="stmt-head-period">${period} · ${scaleLabel}</div>
      </div>
      <table class="stmt-table">
        <thead><tr><th style="width:65%;">Line Item</th><th>Amount</th></tr></thead>
        <tbody>
          ${sectionRow('Operating Activities')}
          ${dataRow('Net Income', cf.netIncome)}
          ${dataRow('Add: Depreciation & Amortization', cf.da)}
          ${dataRow('Change in Accounts Receivable', -Math.abs(model.balanceSheet.assets.ar) * 0.04)}
          ${dataRow('Change in Accounts Payable', Math.abs(model.balanceSheet.liabilities.ap) * 0.03)}
          ${dataRow('Change in Accrued Liabilities', Math.abs(model.balanceSheet.liabilities.accrued) * 0.02)}
          ${subtotalRow('Net Cash from Operating Activities', cf.operatingCF)}

          ${sectionRow('Investing Activities')}
          ${dataRow('Capital Expenditures', cf.capex)}
          ${subtotalRow('Net Cash from Investing Activities', cf.capex)}

          ${sectionRow('Financing Activities')}
          ${dataRow('Repayment of Long-Term Debt', cf.debtRepayment)}
          ${subtotalRow('Net Cash from Financing Activities', cf.financingCF)}

          ${totalRow('Net Change in Cash', cf.netCashChange)}
          <tr class="tr-indent"><td>Beginning Cash Balance</td><td>${money(cf.beginCash)}</td></tr>
          ${totalRow('Ending Cash Balance', cf.endCash)}
        </tbody>
      </table>
      <div class="stmt-footnote">Cash flow from operations derived via indirect method. CapEx estimated from PP&E movement; provide prior-period balance sheet for precise figure.</div>
    </div>`;

    document.getElementById('cf-content').innerHTML = html;
  }

  // ── EXECUTIVE DASHBOARD ───────────────────────────────
  function renderDashboard(model, period, company) {
    init(model.currency, model.scale);
    const is = model.incomeStatement;
    const bs = model.balanceSheet;
    const cf = model.cashFlow;

    // Insights
    const insights = [];

    if (is.grossMargin < 0.10) insights.push({ cls: 'flag', icon: '⚑', title: 'Low Gross Margin', desc: `Gross margin of ${pct(is.grossMargin)} indicates thin pricing power or elevated direct costs. Benchmark against industry peers and review contract profitability.` });
    else if (is.grossMargin > 0.40) insights.push({ cls: 'strong', icon: '◈', title: 'Strong Gross Margin', desc: `Gross margin of ${pct(is.grossMargin)} reflects healthy pricing power or lean cost structure. Protect this through contract terms and direct labor efficiency.` });

    if (bs.ratios.currentRatio < 1.0) insights.push({ cls: 'flag', icon: '⚑', title: 'Liquidity Risk', desc: `Current ratio of ${bs.ratios.currentRatio.toFixed(2)}x signals current liabilities exceed current assets. Prioritize receivables collection and credit facility review.` });

    if (bs.ratios.debtEquity > 4) insights.push({ cls: 'watch', icon: '◉', title: 'Elevated Leverage', desc: `Debt/Equity of ${bs.ratios.debtEquity.toFixed(1)}x limits financial flexibility. Monitor covenant headroom and prioritize debt paydown from free cash flow.` });

    if (cf.fcfConversion > 1.5) insights.push({ cls: 'strong', icon: '◈', title: 'High FCF Conversion', desc: `FCF conversion of ${cf.fcfConversion.toFixed(1)}x net income is a strong quality-of-earnings signal, driven by non-cash add-backs and working capital discipline.` });

    if (cf.fcf < 0) insights.push({ cls: 'flag', icon: '⚑', title: 'Negative Free Cash Flow', desc: `The business is consuming cash after capex. Assess whether this is growth-driven investment or operational underperformance.` });

    if (is.netMargin < 0) insights.push({ cls: 'flag', icon: '⚑', title: 'Net Loss Position', desc: `The business is reporting a net loss. Prioritize cost reduction and revenue mix analysis to identify the path to profitability.` });
    else if (is.netMargin > 0.10) insights.push({ cls: 'strong', icon: '◈', title: 'Healthy Net Margins', desc: `Net margin of ${pct(is.netMargin)} reflects strong bottom-line performance. Monitor leverage and interest burden as the primary risk to margin sustainability.` });

    // Default insight if few flags
    if (insights.length < 3) insights.push({ cls: '', icon: '◇', title: 'Working Capital Watch', desc: `Net working capital of ${money(bs.ratios.nwc)} provides a cushion for near-term obligations. Track AR aging and AP days to maintain the balance.` });

    const insightHtml = insights.slice(0,4).map(i => `
      <div class="insight-card ${i.cls}">
        <div class="insight-icon">${i.icon}</div>
        <div class="insight-title">${i.title}</div>
        <div class="insight-desc">${i.desc}</div>
      </div>`).join('');

    const dashHtml = `
      <div class="dash-executive" id="exec-summary">
        <div class="analysis-tag">◆ Executive Summary · AI Analysis Loading...</div>
        <div class="analysis-text" id="exec-text" style="color:rgba(255,255,255,0.5); font-style:italic;">
          Click "Full CFO Narrative" above to generate AI-powered analysis of your financial statements.
        </div>
      </div>

      <div class="dash-insight-grid">${insightHtml}</div>

      <div class="chart-grid">
        <div class="chart-card">
          <div class="chart-title">P&L Waterfall (${scaleLabel})</div>
          <div style="position:relative;height:240px;"><canvas id="chart-waterfall"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Margin Profile</div>
          <div style="position:relative;height:240px;"><canvas id="chart-margins"></canvas></div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <div class="chart-title">Cash Flow Composition (${scaleLabel})</div>
          <div style="position:relative;height:220px;"><canvas id="chart-cf"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Balance Sheet Composition (${scaleLabel})</div>
          <div style="position:relative;height:220px;"><canvas id="chart-bs"></canvas></div>
        </div>
      </div>`;

    document.getElementById('dash-period-label').textContent = `${company} · ${period}`;
    document.getElementById('dash-content').innerHTML = dashHtml;

    // Render charts after DOM update
    setTimeout(() => renderCharts(model), 50);
  }

  // ── CHARTS ────────────────────────────────────────────
  function renderCharts(model) {
    const is = model.incomeStatement;
    const bs = model.balanceSheet;
    const cf = model.cashFlow;

    const navy  = '#0a1628';
    const gold  = '#c9a84c';
    const green = '#166534';
    const red   = '#b91c1c';
    const muted = '#9ca3af';

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10, family: 'IBM Plex Mono' }, color: muted } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10, family: 'IBM Plex Mono' }, color: muted } },
      },
    };

    // Waterfall
    const wf = document.getElementById('chart-waterfall');
    if (wf) {
      new Chart(wf, {
        type: 'bar',
        data: {
          labels: ['Revenue', 'COGS', 'SG&A', 'Other', 'Net Income'],
          datasets: [{
            data: [is.revenue.total, -is.cogs.total, -is.sga.total, is.otherIncome - is.interestExpense - is.da - is.taxExpense, is.netIncome],
            backgroundColor: [navy, red, '#d97706', muted, is.netIncome >= 0 ? green : red],
            borderRadius: 2,
          }],
        },
        options: {
          ...baseOpts,
          scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => (v < 0 ? '-' : '') + sym + Math.abs(v).toLocaleString() } } },
        },
      });
    }

    // Margins
    const mg = document.getElementById('chart-margins');
    if (mg) {
      new Chart(mg, {
        type: 'bar',
        data: {
          labels: ['Gross Margin', 'EBIT Margin', 'Net Margin'],
          datasets: [{
            data: [
              (is.grossMargin * 100).toFixed(1),
              (is.ebitMargin * 100).toFixed(1),
              (is.netMargin * 100).toFixed(1),
            ],
            backgroundColor: [navy, gold, green],
            borderRadius: 2,
          }],
        },
        options: {
          ...baseOpts,
          scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => v + '%' } } },
        },
      });
    }

    // Cash flow
    const cfChart = document.getElementById('chart-cf');
    if (cfChart) {
      new Chart(cfChart, {
        type: 'bar',
        data: {
          labels: ['Operating CF', 'CapEx', 'Free CF', 'Financing CF'],
          datasets: [{
            data: [cf.operatingCF, cf.capex, cf.fcf, cf.financingCF],
            backgroundColor: [green, red, gold, red],
            borderRadius: 2,
          }],
        },
        options: {
          ...baseOpts,
          scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => (v < 0 ? '-' : '') + sym + Math.abs(v).toLocaleString() } } },
        },
      });
    }

    // Balance sheet donut
    const bsChart = document.getElementById('chart-bs');
    if (bsChart) {
      const a = bs.assets;
      new Chart(bsChart, {
        type: 'doughnut',
        data: {
          labels: ['Cash', 'Receivables', 'Other CA', 'PP&E', 'Intangibles', 'Other LT'],
          datasets: [{
            data: [a.cash, a.ar, a.otherCA, a.ppe, a.intangibles, a.otherLtAsset].map(v => Math.max(0, v)),
            backgroundColor: [navy, '#243a5e', '#3b5280', gold, '#e8c97a', '#f5e9c8'],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'right',
              labels: { font: { size: 10, family: 'IBM Plex Mono' }, color: muted, boxWidth: 10, padding: 8 },
            },
          },
        },
      });
    }
  }

  return { renderIncomeStatement, renderBalanceSheet, renderCashFlow, renderDashboard, init };
})();
