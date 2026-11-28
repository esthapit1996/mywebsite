# GopherDebt Frontend

A React + TypeScript frontend for the GopherDebt expense sharing and personal finance app. Deployed on GitHub Pages.

## Features

- **Group Expenses** — Create groups, add members, split expenses (equal/exact/percentage)
- **Balances & Settlements** — View who owes whom, record payments
- **GopherStash** — Personal expense tracker with categories, receipt scanning, and chart views (pie/bar/pills)
- **GoWish** — Wishlist of things you want to buy (name, optional why, link and cost) with a running total, personal or in shared wish groups with other members
- **GoCrumbs** — Monthly "what's left" calculator for Germany: enter your gross income (or, as a Werkstudent, your hourly wage and hours), extra pay such as on-call, tax class, children and expenses (rent, savings, subscriptions) and see net pay with Lohnsteuer, Soli, church tax and social insurance worked out for employees and Werkstudenten. Calculated live by the backend as you type, with a chart of where the money goes. Budgets are saved as named pages (tabs such as "January" or "After the raise"): up to 15 per work type, each started blank or as a copy of the open one. English only for now
- **Receipt Scanning** — AI-powered receipt parsing via OpenAI on the backend (upload photo → auto-fill expenses). Photos over 4 MB, and formats the AI can't read (iPhone HEIC), are converted to JPEG in the browser first (server limit 14 MB); if the AI is busy, down or unreachable, it falls back to on-device OCR (Tesseract, reading English, Dutch, German, French and Italian receipts). Discounts on the receipt are applied to the amount
- **Currency Conversion** — View amounts in 25 currencies, historical trend charts
- **14 Themes** — 9 dark + 5 light themes, synced to user profile
- **i18n** — English and Italian translations (GoCrumbs is English only for now; texts missing in Italian fall back to English)
- **Suggestion Box** — Feature suggestions with voting, comments, and status tracking
- **Community** — Member list with special titles (Founder, Trailblazer, Mafia Boss)
- **Access Control** — Email whitelist/blacklist management (founder only)
- **Debt Overview** — Cross-group debt summary with per-user drilldown and your net total in the title
- **Payment History** — Full payment log with clear option
- **Avatar & Profile** — Custom avatars, password change, language preference

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deployment to GitHub Pages

```bash
npm run build
cp dist/index.html dist/404.html
# Push changes — GitHub Actions deploys from dist/
```

## Configuration

Update the API URL in `src/services/api.ts`:
```ts
const API_BASE = 'https://your-backend-url.com/api';
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI library |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| react-router-dom | Client-side routing (a hash data router, `createHashRouter`, so pages can block navigation with `useBlocker`) |
| react-i18next | Internationalization (EN + IT) |
| recharts | Pie & bar charts for GopherStash and GoCrumbs |
| CSS Variables | Theming with 14 themes |

## Project Structure

```
src/
├── App.tsx              # Root component, routing, navbar
├── main.tsx             # Entry point
├── index.css            # Global styles + 14 theme definitions
├── vite-env.d.ts        # Vite type declarations
├── pages/
│   ├── Login.tsx         # Login form
│   ├── Register.tsx      # Registration form
│   ├── Dashboard.tsx     # Home — groups, debt overview, GopherStash card
│   ├── GroupDetail.tsx   # Group expenses, balances, settlements, activity
│   ├── GopherStash.tsx   # Personal expense tracker with charts
│   ├── GoWish.tsx        # Shared wish groups + personal wishlist
│   ├── GoWishList.tsx    # One shared wish group (a wish section per member)
│   ├── GoCrumbs.tsx      # Monthly "what's left" calculator (German tax), live calculation + named pages (tabs)
│   ├── PaymentHistory.tsx # Payment history log
│   ├── Suggestions.tsx   # Suggestion box with voting & comments
│   ├── CurrencyConverter.tsx # Currency converter + trend chart
│   ├── CurrencyPicker.tsx # Currency selection page
│   ├── Community.tsx     # Member list with titles
│   ├── Members.tsx       # User management + whitelist/blacklist
│   ├── Settings.tsx      # Profile, avatar, password, language
│   └── pages_readme.md  # 📖 Documentation
├── components/
│   ├── Avatar.tsx        # Avatar display component
│   ├── AvatarPicker.tsx  # Avatar selection modal
│   ├── LoadingSpinner.tsx # Loading indicator
│   ├── MoneyInput.tsx    # Amount input that accepts "4000,50" and "4.000,50" + parseMoney()
│   ├── WishBoard.tsx     # GoWish total, list and add/edit modal (personal + shared)
│   ├── ReceiptScanner.tsx # Receipt scanning (OpenAI via backend, OCR fallback) + receiptAmount()
│   └── GroupEmojiPicker.tsx # Group icon picker (debt groups + GoWish groups)
├── constants/
│   └── gocrumbs.ts      # GoCrumbs route, limits (incl. 15 pages per work type), federal states
├── context/
│   ├── AuthContext.tsx   # Authentication state (user, login, logout)
│   ├── ThemeContext.tsx  # Theme management (14 themes)
│   ├── CurrencyContext.tsx # Currency display (25 currencies)
│   └── context_readme.md # 📖 Documentation
├── services/
│   ├── api.ts           # API client for all backend communication
│   └── services_readme.md # 📖 Documentation
├── i18n/
│   ├── i18n.ts          # i18next configuration
│   ├── en.json          # English translations
│   └── it.json          # Italian translations
├── types/
│   └── index.ts         # TypeScript type definitions
└── images/              # Static images
```
