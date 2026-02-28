# GopherDebt Frontend

A React frontend for the GopherDebt expense sharing app.

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

1. Build the project: `npm run build`
2. Copy 404.html: `cp dist/index.html dist/404.html`
3. Configure GitHub Pages to serve from `dist/` folder (Settings → Pages → Source: Deploy from branch, folder: `/dist`)

Or copy dist contents to root and push:
```bash
npm run build
cp dist/index.html dist/404.html
# Push changes
```

## Configuration

Update the API URL in `src/services/api.js`:
```js
const API_BASE = 'https://your-backend-url.com/api';
```

## Features

- 🔐 User authentication (register/login)
- 👥 Create and manage expense groups
- 💰 Add expenses with equal splits
- 📊 View balances (who owes whom)
- 💸 Record settlements between members
