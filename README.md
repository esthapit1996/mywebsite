# GopherDebt Frontend

A React + TypeScript frontend for the GopherDebt expense sharing and personal finance app. Deployed on GitHub Pages.

## Features

- **Group Expenses** — Create groups, add members, split expenses (equal/exact/percentage)
- **Balances & Settlements** — View who owes whom, record payments
- **GopherStash** — Personal expense tracker with categories, receipt scanning, and chart views (pie/bar/pills)
- **Receipt Scanning** — AI-powered receipt parsing via Google Gemini (upload photo → auto-fill expenses)
- **Currency Conversion** — View amounts in 25 currencies, historical trend charts
- **14 Themes** — 9 dark + 5 light themes, synced to user profile
- **i18n** — Full English and Italian translations
- **Suggestion Box** — Feature suggestions with voting, comments, and status tracking
- **Community** — Member list with special titles (Founder, Trailblazer, Mafia Boss)
- **Access Control** — Email whitelist/blacklist management (founder only)
- **Debt Overview** — Cross-group debt summary with per-user drilldown
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
| react-router-dom | Client-side routing |
| react-i18next | Internationalization (EN + IT) |
| recharts | Pie & bar charts for GopherStash |
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
│   └── ReceiptScanner.tsx # AI receipt scanning component
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
