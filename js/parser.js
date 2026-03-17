/* ═══════════════════════════════════════════
   parser.js — Trial Balance Parsing Engine
   Reads CSV data, classifies GL accounts into
   IS / BS / CF buckets using account code ranges
   and keyword heuristics.
═══════════════════════════════════════════ */

window.Parser = (() => {

  // ── Account Classification Rules ──────────────────────
  // Maps account codes and keywords → financial statement category
  const CLASSIFICATION_RULES = {
    // INCOME STATEMENT
    revenue: {
      codeRanges: [[4000,4999],[40000,49999]],
      keywords: ['revenue','sales','income','fee','service income','billing','contract revenue',
                 'consulting','rental income','subscription','commission earned'],
      signConvention: 'credit', // credits are positive revenue
    },
    cogs: {
      codeRanges: [[5000,5999],[50000,59999]],
      keywords: ['cost of','direct labor','direct material','subcontract','supplies','cogs',
                 'cost of goods','cost of service','field labor','direct cost'],
      signConvention: 'debit',
    },
    sga: {
      codeRanges: [[6000,6999],[60000,69999]],
      keywords: ['salaries','wages','payroll','compensation','benefits','rent','insurance',
                 'utilities','depreciation','amortization','marketing','advertising',
                 'professional fees','legal','accounting','travel','meals','office',
                 'telephone','software','technology','g&a','general','administrative',
                 'management fee'],
      signConvention: 'debit',
    },
    otherIncome: {
      codeRanges: [[7000,7499],[70000,74999]],
      keywords: ['interest income','gain on','other income','miscellaneous income'],
      signConvention: 'credit',
    },
    interestExpense: {
      codeRanges: [[7500,7999],[75000,79999]],
      keywords: ['interest expense','loan interest','bank charges','financing cost'],
      signConvention: 'debit',
    },
    taxExpense: {
      codeRanges: [[8000,8999],[80000,89999]],
      keywords: ['income tax','tax expense','provision for tax','federal tax','state tax'],
      signConvention: 'debit',
    },
    // BALANCE SHEET — ASSETS
    cash: {
      codeRanges: [[1000,1099],[10000,10999]],
      keywords: ['cash','bank','checking','savings','petty cash','money market'],
      bsCategory: 'currentAsset',
    },
    accountsReceivable: {
      codeRanges: [[1100,1199],[11000,11999]],
      keywords: ['accounts receivable','a/r','trade receivable','billed receivable','unbilled','wip','work in progress'],
      bsCategory: 'currentAsset',
    },
    otherCurrentAsset: {
      codeRanges: [[1200,1499],[12000,14999]],
      keywords: ['prepaid','deposit','inventory','other current asset','deferred','short-term'],
      bsCategory: 'currentAsset',
    },
    ppe: {
      codeRanges: [[1500,1699],[15000,16999]],
      keywords: ['property','plant','equipment','furniture','fixtures','vehicle','machinery',
                 'leasehold','building','land','computer equipment','accumulated depreciation'],
      bsCategory: 'nonCurrentAsset',
    },
    intangibles: {
      codeRanges: [[1700,1899],[17000,18999]],
      keywords: ['goodwill','intangible','trademark','patent','customer list','non-compete',
                 'software development','capitalized software'],
      bsCategory: 'nonCurrentAsset',
    },
    otherLtAsset: {
      codeRanges: [[1900,1999],[19000,19999]],
      keywords: ['long-term deposit','note receivable','investment','deferred tax asset','other asset'],
      bsCategory: 'nonCurrentAsset',
    },
    // BALANCE SHEET — LIABILITIES
    accountsPayable: {
      codeRanges: [[2000,2099],[20000,20999]],
      keywords: ['accounts payable','a/p','trade payable','vendor payable'],
      bsCategory: 'currentLiability',
    },
    accruedLiabilities: {
      codeRanges: [[2100,2299],[21000,22999]],
      keywords: ['accrued','accrual','wages payable','salary payable','bonus payable',
                 'vacation payable','customer deposit','deferred revenue','unearned'],
      bsCategory: 'currentLiability',
    },
    currentDebt: {
      codeRanges: [[2300,2499],[23000,24999]],
      keywords: ['current portion','line of credit','revolver','short-term debt','credit card payable'],
      bsCategory: 'currentLiability',
    },
    longTermDebt: {
      codeRanges: [[2500,2699],[25000,26999]],
      keywords: ['long-term debt','long term loan','term loan','note payable','mortgage','bonds payable'],
      bsCategory: 'nonCurrentLiability',
    },
    otherLtLiability: {
      codeRanges: [[2700,2899],[27000,28999]],
      keywords: ['deferred tax liability','other long-term','pension','lease liability'],
      bsCategory: 'nonCurrentLiability',
    },
    // EQUITY
    equity: {
      codeRanges: [[3000,3999],[30000,39999]],
      keywords: ['common stock','paid-in capital','apic','retained earnings','member equity',
                 'owner equity','partner capital','dividend','distribution','accumulated deficit'],
      bsCategory: 'equity',
    },
  };

  // ── Classify a single account ──────────────────────────
  function classifyAccount(accountName, accountCode, balance) {
    const name = (accountName || '').toLowerCase().trim();
    const code = parseFloat(accountCode) || 0;

    for (const [category, rule] of Object.entries(CLASSIFICATION_RULES)) {
      // Check code ranges
      if (rule.codeRanges) {
        for (const [min, max] of rule.codeRanges) {
          if (code >= min && code <= max) {
            return { category, rule };
          }
        }
      }
      // Check keywords
      if (rule.keywords) {
        for (const kw of rule.keywords) {
          if (name.includes(kw)) {
            return { category, rule };
          }
        }
      }
    }

    // Fallback: guess from balance sign and code range
    if (code >= 4000 && code < 5000) return { category: 'revenue', rule: CLASSIFICATION_RULES.revenue };
    if (code >= 5000 && code < 6000) return { category: 'cogs', rule: CLASSIFICATION_RULES.cogs };
    if (code >= 6000 && code < 7000) return { category: 'sga', rule: CLASSIFICATION_RULES.sga };
    if (code >= 1000 && code < 2000) return { category: 'otherCurrentAsset', rule: CLASSIFICATION_RULES.otherCurrentAsset };
    if (code >= 2000 && code < 3000) return { category: 'otherLtLiability', rule: CLASSIFICATION_RULES.otherLtLiability };
    if (code >= 3000 && code < 4000) return { category: 'equity', rule: CLASSIFICATION_RULES.equity };

    return { category: 'sga', rule: CLASSIFICATION_RULES.sga }; // default
  }

  // ── Detect columns from CSV headers ───────────────────
  function detectColumns(headers) {
    const h = headers.map(x => (x||'').toLowerCase().trim());
    const find = (terms) => {
      for (const t of terms) {
        const idx = h.findIndex(x => x.includes(t));
        if (idx >= 0) return { idx, name: headers[idx] };
      }
      return null;
    };

    return {
      accountName: find(['account name','account description','description','name','gl account','account title']),
      accountCode: find(['account no','account code','account number','account id','gl code','code','number','acct']),
      balance:     find(['net balance','balance','amount','net amount','ending balance','total','ytd','debit','credit']),
      debit:       find(['debit']),
      credit:      find(['credit']),
    };
  }

  // ── Parse raw CSV text into structured rows ────────────
  function parseCSV(text) {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: h => h.trim(),
    });
    return result;
  }

  // ── Main parse function ────────────────────────────────
  function parseTrialBalance(text, colMap) {
    const parsed = parseCSV(text);
    const { data, meta } = parsed;
    const headers = meta.fields || [];

    // Auto-detect columns if not provided
    const cols = colMap || detectColumns(headers);

    const accounts = [];
    let skippedRows = 0;

    for (const row of data) {
      const nameKey  = cols.accountName ? cols.accountName.name : headers[0];
      const codeKey  = cols.accountCode ? cols.accountCode.name : headers[1];
      const balKey   = cols.balance     ? cols.balance.name     : headers[2];

      const rawName  = (row[nameKey] || '').trim();
      const rawCode  = (row[codeKey] || '').trim();
      let   rawBal   = (row[balKey]  || '0').toString().trim();

      // Skip grand total rows, blank rows, header repeats
      if (!rawName || rawName.toLowerCase().includes('grand total') ||
          rawName.toLowerCase().includes('total:') ||
          rawName.toLowerCase() === 'account name') {
        skippedRows++;
        continue;
      }

      // Clean balance — remove $, commas, parentheses (negatives)
      const isParens = rawBal.startsWith('(') && rawBal.endsWith(')');
      rawBal = rawBal.replace(/[$,()]/g, '').trim();
      let balance = parseFloat(rawBal) || 0;
      if (isParens) balance = -Math.abs(balance);

      // Handle separate debit/credit columns
      if (balance === 0 && cols.debit && cols.credit) {
        const debitKey  = cols.debit.name;
        const creditKey = cols.credit.name;
        const debit  = parseFloat((row[debitKey]  || '0').toString().replace(/[$,()]/g,'')) || 0;
        const credit = parseFloat((row[creditKey] || '0').toString().replace(/[$,()]/g,'')) || 0;
        balance = debit - credit;
      }

      const { category, rule } = classifyAccount(rawName, rawCode, balance);

      accounts.push({
        name: rawName,
        code: rawCode,
        balance,
        category,
        rule,
        isIncomeStmt: ['revenue','cogs','sga','otherIncome','interestExpense','taxExpense'].includes(category),
        isBalanceSheet: ['cash','accountsReceivable','otherCurrentAsset','ppe','intangibles','otherLtAsset',
                        'accountsPayable','accruedLiabilities','currentDebt','longTermDebt','otherLtLiability','equity'].includes(category),
      });
    }

    return { accounts, headers, skippedRows, rowCount: data.length };
  }

  // ── Build structured financial model from accounts ─────
  function buildModel(accounts, scale, currency) {
    const s = parseInt(scale) || 1000;

    const group = (cat) => accounts
      .filter(a => a.category === cat)
      .map(a => ({
        name: a.name,
        value: Math.round(a.balance / s * 100) / 100,
      }));

    const sum = (cat) => accounts
      .filter(a => a.category === cat)
      .reduce((acc, a) => acc + a.balance, 0) / s;

    // ── Income Statement ──
    const totalRevenue        = Math.abs(sum('revenue'));
    const totalCOGS           = Math.abs(sum('cogs'));
    const grossProfit         = totalRevenue - totalCOGS;
    const grossMargin         = totalRevenue ? grossProfit / totalRevenue : 0;
    const totalSGA            = Math.abs(sum('sga'));
    const ebit                = grossProfit - totalSGA;
    const ebitMargin          = totalRevenue ? ebit / totalRevenue : 0;
    const otherIncome         = Math.abs(sum('otherIncome'));
    const interestExpense     = Math.abs(sum('interestExpense'));
    const taxExpense          = Math.abs(sum('taxExpense'));
    const netIncome           = ebit + otherIncome - interestExpense - taxExpense;
    const netMargin           = totalRevenue ? netIncome / totalRevenue : 0;

    const da = accounts.filter(a =>
      a.name.toLowerCase().includes('depreciation') ||
      a.name.toLowerCase().includes('amortization')
    ).reduce((acc, a) => acc + Math.abs(a.balance), 0) / s;
    const ebitda = ebit + da;

    // ── Balance Sheet ──
    const cashVal             = Math.abs(sum('cash'));
    const arVal               = Math.abs(sum('accountsReceivable'));
    const otherCAVal          = Math.abs(sum('otherCurrentAsset'));
    const totalCurrentAssets  = cashVal + arVal + otherCAVal;
    const ppeVal              = Math.abs(sum('ppe'));
    const intangiblesVal      = Math.abs(sum('intangibles'));
    const otherLtAssetVal     = Math.abs(sum('otherLtAsset'));
    const totalNonCurrentAssets = ppeVal + intangiblesVal + otherLtAssetVal;
    const totalAssets         = totalCurrentAssets + totalNonCurrentAssets;

    const apVal               = Math.abs(sum('accountsPayable'));
    const accruedVal          = Math.abs(sum('accruedLiabilities'));
    const currentDebtVal      = Math.abs(sum('currentDebt'));
    const totalCurrentLiab    = apVal + accruedVal + currentDebtVal;
    const ltDebtVal           = Math.abs(sum('longTermDebt'));
    const otherLtLiabVal      = Math.abs(sum('otherLtLiability'));
    const totalNonCurrentLiab = ltDebtVal + otherLtLiabVal;
    const equityVal           = totalAssets - totalCurrentLiab - totalNonCurrentLiab;
    const totalLiabEquity     = totalCurrentLiab + totalNonCurrentLiab + equityVal;

    // Ratios
    const currentRatio        = totalCurrentLiab ? totalCurrentAssets / totalCurrentLiab : 0;
    const debtEquity          = equityVal ? (ltDebtVal + currentDebtVal) / equityVal : 0;
    const nwc                 = totalCurrentAssets - totalCurrentLiab;

    // ── Cash Flow (indirect method) ──
    const operatingCF         = netIncome + da + (arVal * -0.04) + (otherCAVal * -0.01) + (apVal * 0.03) + (accruedVal * 0.02);
    const capex               = -(ppeVal * 0.06); // estimated; real capex requires prior-period BS
    const fcf                 = operatingCF + capex;
    const debtRepayment       = -(ltDebtVal * 0.09);
    const financingCF         = debtRepayment;
    const netCashChange       = operatingCF + capex + financingCF;

    return {
      scale: s,
      currency,
      incomeStatement: {
        revenue:       { items: group('revenue'), total: totalRevenue },
        cogs:          { items: group('cogs'),    total: totalCOGS },
        grossProfit,   grossMargin,
        sga:           { items: group('sga'),     total: totalSGA },
        ebit,          ebitMargin,
        da,            ebitda,
        otherIncome,   interestExpense,
        taxExpense,    netIncome, netMargin,
      },
      balanceSheet: {
        assets: {
          cash: cashVal, ar: arVal, otherCA: otherCAVal,
          totalCurrentAssets, ppe: ppeVal, intangibles: intangiblesVal,
          otherLtAsset: otherLtAssetVal, totalNonCurrentAssets, totalAssets,
        },
        liabilities: {
          ap: apVal, accrued: accruedVal, currentDebt: currentDebtVal,
          totalCurrentLiab, ltDebt: ltDebtVal, otherLtLiab: otherLtLiabVal,
          totalNonCurrentLiab, equityVal, totalLiabEquity,
        },
        ratios: { currentRatio, debtEquity, nwc },
      },
      cashFlow: {
        netIncome, da,
        operatingCF, capex, fcf,
        financingCF, debtRepayment,
        netCashChange,
        beginCash: cashVal - netCashChange,
        endCash: cashVal,
        fcfConversion: netIncome ? fcf / netIncome : 0,
      },
      accountList: accounts,
    };
  }

  // ── Format number for display ─────────────────────────
  function fmt(val, opts = {}) {
    const { showSign = false, decimals = 0, parentheses = true } = opts;
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (val < 0) return parentheses ? `(${formatted})` : `-${formatted}`;
    if (showSign && val > 0) return `+${formatted}`;
    return formatted;
  }

  function fmtPct(val, decimals = 1) {
    return (val * 100).toFixed(decimals) + '%';
  }

  // ── Detect columns (exposed for UI dropdowns) ─────────
  function getColumnOptions(csvText) {
    const parsed = Papa.parse(csvText, { header: true, preview: 3 });
    return parsed.meta.fields || [];
  }

  return { parseTrialBalance, buildModel, detectColumns, getColumnOptions, fmt, fmtPct };
})();
