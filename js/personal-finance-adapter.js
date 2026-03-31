/**
 * Personal Finance Adapter
 * Converts bank/credit/Venmo statements → trial balance for personal finance modeling
 */

const PERSONAL_ACCOUNT_CLASSIFIER = {
  // Income accounts (credit balance = revenue)
  'income': {
    keywords: ['salary', 'kbs', 'deposit', 'paycheck', 'ksv', 'venmo', 'check deposit'],
    subcategories: {
      'employer_salary': ['kbs', 'kbs-osv', 'salary'],
      'employment_income': ['uc berkeley', 'ug', 'gi', 'gsi', 'ta', 'teaching'],
      'other_income': ['bonus', 'dividend', 'interest', 'refund'],
    }
  },

  // Asset accounts (debit balance)
  'assets': {
    'checking': {
      keywords: ['us bank', 'bank checking', 'checking account'],
    },
    'savings': {
      keywords: ['savings', 'money market'],
    },
    'investments': {
      keywords: ['brokerage', 'u.s. bancorp', 'investment'],
    },
  },

  // Liability accounts (credit balance)
  'liabilities': {
    'credit_cards': {
      keywords: ['amex', 'citi', 'chase', 'autopay', 'epayment'],
    },
    'loans': {
      keywords: ['loan', 'car loan', 'student loan', 'dept education', 'usbank loan'],
    },
  },

  // Expense accounts (debit balance = expense)
  'expenses': {
    'housing': {
      keywords: ['rent', 'carolyn silk', 'landlord', 'mortgage'],
    },
    'utilities': {
      keywords: ['sonic net', 'internet', 'electric', 'gas', 'water'],
    },
    'transportation': {
      keywords: ['car loan', 'gas', 'fuel', 'parking'],
    },
    'health_fitness': {
      keywords: ['funky door', 'gym', 'yoga', 'fitness'],
    },
    'groceries': {
      keywords: ['costco', 'raley', 'grocery', 'food', 'market'],
    },
    'dining': {
      keywords: ['restaurant', 'coffee', 'bar', 'cafe', 'pizza', 'tap in', 'taproom', 'brewery', 'bakery', 'snarf', 'saul', 'cask'],
    },
    'travel': {
      keywords: ['airasia', 'hotel', 'hilton', 'bali', 'tahoe', 'carmel', 'transportation'],
    },
    'entertainment': {
      keywords: ['movie', 'concert', 'event', 'sports', 'game', 'madness', 'poker', 'bracket'],
    },
    'subscriptions': {
      keywords: ['apple', 'prime', 'adobe', 'netflix', 'spotify'],
    },
    'personal_care': {
      keywords: ['salon', 'haircut', 'doctor', 'pharmacy', 'health'],
    },
  },

  // Special transfers (non-operating)
  'transfers': {
    keywords: ['transfer', 'deposit 8917', 'deposit 9129', 'deposit 3687'],
  },

  'education': {
    keywords: ['dept education', 'student loan', 'tuition'],
  },

  'shared_expenses': {
    keywords: ['hayley', 'venmo', 'split'],
  }
};

/**
 * Classify a transaction by description and amount
 */
function classifyTransaction(date, description, amount, source = 'bank') {
  const desc = description.toLowerCase().trim();
  const isExpense = amount < 0;
  const isIncome = amount > 0;

  // Special cases first
  if (desc.includes('carolyn silk') && isExpense) {
    return { category: 'housing', subcategory: 'rent', type: 'expense' };
  }
  if (desc.includes('hayley carter') && isIncome) {
    return { category: 'shared_income', subcategory: 'rent_offset', type: 'income' };
  }
  if (desc.includes('hayley carter') && isExpense) {
    return { category: 'shared_income', subcategory: 'rent_transfer', type: 'non-operating' };
  }
  if (desc.includes('funky door')) {
    return { category: 'health_fitness', subcategory: 'gym', type: 'expense' };
  }
  if (desc.includes('sonic net')) {
    return { category: 'utilities', subcategory: 'internet', type: 'expense' };
  }
  if (desc.includes('usbank loan') || desc.includes('car loan')) {
    return { category: 'liabilities', subcategory: 'car_loan', type: 'expense' };
  }
  if (desc.includes('dept education') || desc.includes('student loan')) {
    return { category: 'education', subcategory: 'student_loan_payment', type: 'non-operating' };
  }
  if (desc.includes('u.s. bancorp inv') || desc.includes('web transfer to inv')) {
    return { category: 'investments', subcategory: 'brokerage', type: 'non-operating' };
  }
  if (desc.includes('transfer') || desc.includes('deposit')) {
    return { category: 'transfers', subcategory: 'internal', type: 'non-operating' };
  }

  // Keyword matching for income
  if (isIncome) {
    if (desc.includes('kbs')) return { category: 'income', subcategory: 'employer_salary', type: 'income' };
    if (desc.includes('uc berkeley') || desc.includes('gsi') || desc.includes('ta')) {
      return { category: 'income', subcategory: 'employment_income', type: 'income' };
    }
    if (desc.includes('check deposit')) return { category: 'income', subcategory: 'other_income', type: 'income' };
    if (desc.includes('venmo')) return { category: 'income', subcategory: 'venmo_inflows', type: 'income' };
  }

  // Keyword matching for expenses
  if (isExpense) {
    for (const [category, catObj] of Object.entries(PERSONAL_ACCOUNT_CLASSIFIER.expenses)) {
      for (const keyword of catObj.keywords) {
        if (desc.includes(keyword)) {
          return { category, subcategory: keyword, type: 'expense' };
        }
      }
    }

    // Venmo catches-all
    if (source === 'venmo' || desc.includes('venmo')) {
      return { category: 'entertainment', subcategory: 'social_splits', type: 'expense' };
    }
  }

  // Fallback
  return { category: 'other', subcategory: 'uncategorized', type: isExpense ? 'expense' : isIncome ? 'income' : 'transfer' };
}

/**
 * Parse bank statement CSV
 */
function parseBankStatement(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parse (handle quoted fields)
    const parts = line.match(/("([^"]*)"|[^,]+)/g).map(x => x.replace(/^"|"$/g, '').trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = parts[idx] || '';
    });

    const date = obj['Date'] || obj['date'];
    const description = obj['Description'] || obj['Name'] || obj['description'] || '';
    const amount = parseFloat(obj['Amount'] || obj['amount'] || '0');

    if (!date || !amount) continue;

    const classified = classifyTransaction(date, description, amount, 'bank');
    transactions.push({
      date,
      description,
      amount,
      ...classified
    });
  }

  return transactions;
}

/**
 * Parse Citi credit card CSV
 */
function parseCitiStatement(csv) {
  const lines = csv.trim().split('\n');
  const transactions = [];

  // Skip header rows
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.includes('Cleared')) continue;

    const parts = line.split(',');
    if (parts.length < 5) continue;

    const date = parts[1]?.trim() || '';
    const description = parts[2]?.trim() || '';
    const debit = parseFloat(parts[3]?.trim() || '0');
    const credit = parseFloat(parts[4]?.trim() || '0');
    const amount = credit - debit; // Credit is inflow, debit is outflow

    if (!date || !amount) continue;

    const classified = classifyTransaction(date, description, amount, 'citi');
    transactions.push({
      date,
      description,
      amount,
      ...classified
    });
  }

  return transactions;
}

/**
 * Parse Venmo CSV
 */
function parseVenmoStatement(csv) {
  const lines = csv.trim().split('\n');
  const transactions = [];
  let inData = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Datetime') || line.includes('Account Activity')) {
      inData = true;
      continue;
    }

    if (!inData || !line.trim() || line.includes('Disclaimer')) break;

    // Parse Venmo CSV (complex format)
    const parts = line.split(',');
    if (parts.length < 10) continue;

    let datetime = parts[2]?.trim().replace(/"/g, '') || '';
    let note = parts[5]?.trim().replace(/"/g, '') || '';
    let amount = parts[8]?.trim().replace(/"/g, '').replace(/[+\-$, ]/g, '') || '0';

    if (!datetime || !amount) continue;

    // Parse amount (+ means inflow, - means outflow)
    const amountText = parts[8]?.trim();
    const isInflow = amountText.includes('+');
    const isMoney = parseFloat(amount) > 0;

    const finalAmount = isInflow ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount));
    const date = datetime.split('T')[0];

    const classified = classifyTransaction(date, note, finalAmount, 'venmo');
    transactions.push({
      date,
      description: note,
      amount: finalAmount,
      ...classified
    });
  }

  return transactions;
}

/**
 * Aggregate transactions into trial balance format
 */
function aggregateToTrialBalance(allTransactions) {
  const accounts = {};

  for (const txn of allTransactions) {
    const key = txn.category + '|' + txn.subcategory;
    if (!accounts[key]) {
      accounts[key] = {
        account_name: txn.category + ': ' + txn.subcategory,
        account_code: generateAccountCode(txn.category, txn.subcategory),
        balance: 0,
        type: txn.type,
      };
    }
    accounts[key].balance += txn.amount;
  }

  // Convert to trial balance rows
  const trialBalance = [];
  for (const [key, acct] of Object.entries(accounts)) {
    if (acct.balance !== 0) {
      trialBalance.push({
        'Account No.': acct.account_code,
        'Account Name': acct.account_name,
        'Net Balance': acct.balance
      });
    }
  }

  return trialBalance;
}

/**
 * Generate account code based on GL standards
 */
function generateAccountCode(category, subcategory) {
  const codes = {
    'income': '4000',
    'shared_income': '4100',
    'assets': '1000',
    'checking': '1010',
    'savings': '1020',
    'investments': '1500',
    'liabilities': '2000',
    'credit_cards': '2100',
    'loans': '2200',
    'housing': '6100',
    'utilities': '6200',
    'transportation': '6300',
    'health_fitness': '6400',
    'groceries': '6500',
    'dining': '6510',
    'travel': '6600',
    'entertainment': '6700',
    'subscriptions': '6800',
    'personal_care': '6900',
    'education': '2300',
  };

  return codes[category] || '9999';
}

/**
 * Main adapter: takes CSV strings, returns trial balance
 */
function adaptPersonalFinance(bankCsv, citiCsv, venmoCsvArray) {
  const bankTxns = bankCsv ? parseBankStatement(bankCsv) : [];
  const citiTxns = citiCsv ? parseCitiStatement(citiCsv) : [];
  const venmoTxns = venmoCsvArray.flatMap(csv => parseVenmoStatement(csv));

  const allTxns = [...bankTxns, ...citiTxns, ...venmoTxns];
  const trialBalance = aggregateToTrialBalance(allTxns);

  return {
    transactions: allTxns,
    trial_balance: trialBalance,
    summary: {
      total_transactions: allTxns.length,
      total_income: allTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      total_expenses: -allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      total_transfers: -allTxns.filter(t => t.type === 'non-operating').reduce((s, t) => s + t.amount, 0),
    }
  };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.PersonalFinanceAdapter = {
    classifyTransaction,
    parseBankStatement,
    parseCitiStatement,
    parseVenmoStatement,
    aggregateToTrialBalance,
    adaptPersonalFinance
  };
}
