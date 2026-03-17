/* ═══════════════════════════════════════════
   ai.js — Anthropic API Integration
   Sends financial model context to Claude
   and streams CFO-level analysis back.
═══════════════════════════════════════════ */

window.AI = (() => {

  let apiKey = null;
  let conversationHistory = [];
  let currentModel = null;
  let currentCompany = '';
  let currentPeriod = '';

  function setKey(key) {
    apiKey = key.trim();
  }

  function setContext(model, company, period) {
    currentModel = model;
    currentCompany = company;
    currentPeriod = period;
    conversationHistory = []; // reset on new model
  }

  function buildFinancialSummary(model) {
    if (!model) return 'No financial data loaded.';
    const is = model.incomeStatement;
    const bs = model.balanceSheet;
    const cf = model.cashFlow;
    const fmt = window.Parser.fmt;
    const fmtPct = window.Parser.fmtPct;
    const s = model.scale === 1000000 ? 'M' : model.scale === 1000 ? 'K' : '';

    return `
COMPANY: ${currentCompany}
PERIOD: ${currentPeriod}
CURRENCY: ${model.currency} (scale: ${model.scale === 1 ? 'actuals' : model.scale === 1000 ? 'thousands' : 'millions'})

=== INCOME STATEMENT ===
Revenue: ${fmt(is.revenue.total)}${s}
Cost of Revenue: ${fmt(is.cogs.total)}${s}
Gross Profit: ${fmt(is.grossProfit)}${s} | Gross Margin: ${fmtPct(is.grossMargin)}
SG&A Expenses: ${fmt(is.sga.total)}${s}
EBIT: ${fmt(is.ebit)}${s} | EBIT Margin: ${fmtPct(is.ebitMargin)}
EBITDA: ${fmt(is.ebitda)}${s} | EBITDA Margin: ${fmtPct(is.ebitda / (is.revenue.total || 1))}
Interest Expense: ${fmt(is.interestExpense)}${s}
Tax Expense: ${fmt(is.taxExpense)}${s}
Net Income: ${fmt(is.netIncome)}${s} | Net Margin: ${fmtPct(is.netMargin)}

=== BALANCE SHEET ===
Cash: ${fmt(bs.assets.cash)}${s}
Accounts Receivable: ${fmt(bs.assets.ar)}${s}
Total Current Assets: ${fmt(bs.assets.totalCurrentAssets)}${s}
Total Assets: ${fmt(bs.assets.totalAssets)}${s}
Accounts Payable: ${fmt(bs.liabilities.ap)}${s}
Total Current Liabilities: ${fmt(bs.liabilities.totalCurrentLiab)}${s}
Long-Term Debt: ${fmt(bs.liabilities.ltDebt)}${s}
Total Equity: ${fmt(bs.liabilities.equityVal)}${s}
Current Ratio: ${bs.ratios.currentRatio.toFixed(2)}x
Debt/Equity: ${bs.ratios.debtEquity.toFixed(2)}x
Net Working Capital: ${fmt(bs.ratios.nwc)}${s}

=== CASH FLOW ===
Operating Cash Flow: ${fmt(cf.operatingCF)}${s}
CapEx: ${fmt(cf.capex)}${s}
Free Cash Flow: ${fmt(cf.fcf)}${s}
Financing Cash Flow: ${fmt(cf.financingCF)}${s}
FCF / Net Income: ${cf.fcfConversion.toFixed(2)}x
    `.trim();
  }

  const SYSTEM_PROMPT = `You are a senior financial analyst with 20 years of experience at top-tier investment banks (Goldman Sachs, JPMorgan) and strategy consulting firms (McKinsey). You specialize in corporate finance, FP&A, and M&A analysis.

Your role is to analyze financial statements and provide insights that a CFO or board of directors would find actionable and valuable.

Communication style:
- Be direct, precise, and quantitative — always anchor observations in specific numbers
- Lead with the most important insight, not with background
- Use institutional language: "gross margin compression," "working capital dynamics," "debt service coverage," "quality of earnings"
- Flag risks clearly with their potential magnitude
- Provide specific, actionable recommendations — not generic advice
- Structure longer responses with clear sections
- Never pad responses with unnecessary caveats or disclaimers

Format responses in clean prose with bold for key metrics. No bullet points — write in the style of an executive memo.`;

  async function callAPI(userMessage, onChunk) {
    if (!apiKey) throw new Error('API key not set. Please enter your Anthropic API key.');

    const financialContext = buildFinancialSummary(currentModel);

    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: `Here is the financial data for ${currentCompany} (${currentPeriod}):\n\n${financialContext}\n\n---\n\n${userMessage}`,
      },
    ];

    // For subsequent messages in a conversation, don't re-send the full context
    const apiMessages = conversationHistory.length === 0
      ? messages
      : [...conversationHistory, { role: 'user', content: userMessage }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              if (onChunk) onChunk(parsed.delta.text);
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    }

    // Save to conversation history
    conversationHistory.push({ role: 'user', content: userMessage });
    conversationHistory.push({ role: 'assistant', content: fullText });

    return fullText;
  }

  const PROMPTS = {
    income: 'Provide a concise CFO-level analysis of the Income Statement. What are the key revenue drivers, margin dynamics, and the 2–3 most important observations a board member should know?',
    balance: 'Analyze the Balance Sheet. Focus on liquidity position, leverage risk, working capital efficiency, and any structural concerns. What should management prioritize?',
    cashflow: 'Analyze the Cash Flow Statement. What does FCF conversion tell us about earnings quality? Are there working capital red flags? Is the business self-funding or reliant on external capital?',
    full: 'Provide a comprehensive CFO-level executive narrative covering all three financial statements. Structure it as: (1) Overall financial health summary, (2) Income statement insights, (3) Balance sheet risks and strengths, (4) Cash flow quality assessment, (5) Top 3 strategic priorities for the next 12 months. Be specific and quantitative throughout.',
  };

  function getPrompt(type) {
    return PROMPTS[type] || PROMPTS.full;
  }

  return { setKey, setContext, callAPI, getPrompt, buildFinancialSummary };
})();
