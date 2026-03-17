# FinStatement — Institutional Financial Reporting Tool

> An AI-powered three-statement financial modeling tool built for any business — from solo operators to enterprise finance teams.

![FinStatement](https://img.shields.io/badge/Built%20with-Anthropic%20Claude-orange) ![License](https://img.shields.io/badge/License-MIT-blue) ![No Backend](https://img.shields.io/badge/Backend-None%20Required-green)

---

## What It Does

Upload your raw financial documents and get a fully-formatted, CFO-ready financial model in seconds:

- **Income Statement** — Revenue → Gross Profit → EBIT → Net Income with margin analysis
- **Balance Sheet** — Assets, Liabilities & Equity with liquidity and leverage ratios
- **Cash Flow Statement** — Indirect method, FCF calculation, financing activities
- **Executive Dashboard** — AI-generated CFO narrative, risk/opportunity flags, and visual charts

### Supported Upload Formats

| Document Type | Formats |
|---|---|
| Trial Balance (**required**) | CSV, XLSX, XLS |
| Bank Statements | CSV, XLSX, PDF |
| AR / AP Aging Schedules | CSV, XLSX, PDF |
| Debt & Loan Schedules | CSV, XLSX, PDF |
| Credit Card Statements | CSV, XLSX, PDF |
| Other Supporting Schedules | CSV, XLSX, PDF |

---

## How It Works

```
1. Upload trial balance (CSV/Excel)
2. Map your column names (account name, code, balance)
3. Click "Generate Financial Model"
4. AI classifies all GL accounts into P&L, Balance Sheet, and Cash Flow buckets
5. Statements are rendered with institutional formatting
6. Click "Analyze with AI" for CFO-level insight narratives
```

### Account Classification Engine

The parser auto-classifies GL accounts using:
- **Account code ranges** — standard chart of accounts numbering (1xxx assets, 2xxx liabilities, 3xxx equity, 4xxx revenue, 5xxx COGS, 6xxx SGA, 7xxx other, 8xxx tax)
- **Keyword matching** — account names are matched against 100+ financial terminology keywords
- **Sign convention** — credits for revenue/liabilities, debits for expenses/assets

---

## Getting Started

### Option 1 — Run Locally (No Installation)

```bash
git clone https://github.com/yourusername/financial-reporting-tool.git
cd financial-reporting-tool
open index.html
```

That's it. No npm, no build step, no server required. Pure HTML/CSS/JS.

### Option 2 — GitHub Pages (Free Hosting)

1. Fork this repository
2. Go to Settings → Pages → Source: `main` branch
3. Your tool is live at `https://yourusername.github.io/financial-reporting-tool`

### Option 3 — Netlify / Vercel Drop

Drag the project folder into [netlify.com/drop](https://app.netlify.com/drop) for instant deployment.

---

## API Key Setup

The AI analysis features require an Anthropic API key:

1. Get a key at [console.anthropic.com](https://console.anthropic.com)
2. Paste it into the "Connect API Key" field in the app
3. Your key is stored only in your browser session — never transmitted anywhere except directly to Anthropic's API

**Note:** The three-statement model generation works **without** an API key. The AI narrative features (CFO analysis, follow-up questions) require the key.

---

## Trial Balance Format

Your trial balance CSV should have at minimum:

```csv
Account No., Account Name, Net Balance
1000, Cash & Checking, 125000
1100, Accounts Receivable, 340000
4000, Service Revenue, -890000
5000, Direct Labor, 420000
...
```

- Negative balances = credit accounts (revenue, liabilities, equity)
- Positive balances = debit accounts (expenses, assets)
- The column mapper lets you configure which columns map to which fields
- Grand Total rows are automatically excluded

---

## Project Structure

```
financial-reporting-tool/
├── index.html          # Application shell & layout
├── css/
│   └── style.css       # Full design system (Navy/Gold/Serif aesthetic)
├── js/
│   ├── parser.js       # Trial balance parsing & GL classification engine
│   ├── renderer.js     # Statement HTML generation & Chart.js charts
│   ├── ai.js           # Anthropic API integration & streaming
│   └── app.js          # Application controller & state management
└── README.md
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| CSV Parsing | [PapaParse](https://www.papaparse.com/) |
| Charts | [Chart.js](https://www.chartjs.org/) |
| AI Analysis | [Anthropic Claude API](https://docs.anthropic.com) (`claude-opus-4-5`) |
| Typography | Playfair Display, IBM Plex Sans, IBM Plex Mono |
| Hosting | Any static host (GitHub Pages, Netlify, Vercel) |

No Node.js. No build tools. No database. No backend.

---

## Key Features

### For Small Businesses & Individuals
- Upload a simple QuickBooks or Excel export → instant three-statement model
- No accounting software required
- Works with any CSV trial balance format

### For Finance Professionals
- Full GL classification engine with 1,000+ keyword rules
- Separate debit/credit column support
- Export all statements to CSV
- AI-powered variance analysis and management commentary

### For Investors & Analysts
- FCF conversion analysis
- Leverage and liquidity ratio dashboard
- Executive-ready PDF-quality formatting (Navy/Gold institutional design)

---

## Customization

### Add Your Company Logo
Replace the `◆ FinStatement` text in `index.html` with your logo image.

### Extend the Classification Rules
In `js/parser.js`, the `CLASSIFICATION_RULES` object maps account codes and keywords to financial statement categories. Add industry-specific terms as needed.

### Change the Color Scheme
All colors are CSS variables in `css/style.css` under `:root`. The current palette is Navy (`#0a1628`) + Gold (`#c9a84c`) + Cream (`#faf8f3`).

---

## Privacy & Data Security

- **No data is stored** — all processing happens in your browser
- **No server** — the app is 100% static files
- **API calls go directly to Anthropic** — your financial data is sent only to Anthropic's API when you click "Analyze with AI" and is subject to [Anthropic's privacy policy](https://www.anthropic.com/privacy)
- **API key stored in sessionStorage** — cleared when you close the browser tab

---

## Roadmap

- [ ] Prior-year comparative columns (upload two periods)
- [ ] Excel (.xlsx) export with formatting
- [ ] PDF export of full financial package
- [ ] Budget vs. Actual variance analysis
- [ ] Multi-entity / consolidation support
- [ ] Revenue segmentation charts

---

## License

MIT — free to use, modify, and distribute. Attribution appreciated.

---

## Author

Built by Hayden — FP&A & Financial Automation specialist.

*Built with [Claude](https://claude.ai) by Anthropic.*
