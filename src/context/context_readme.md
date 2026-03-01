# 🎨 React Context (`src/context/`)

Context provides **global state** that can be accessed by any component without passing props through every level.

---

## 📚 Libraries Used

| Library | Import | Purpose |
|---------|--------|---------|
| `react` | `createContext, useContext, useState, useEffect, useCallback` | React hooks for state and context |
| `api` | `../services/api` | API calls to backend |

---

## 📁 Files Overview

| File | Purpose | State Managed |
|------|---------|---------------|
| `AuthContext.jsx` | User authentication | Current user, login/logout |
| `ThemeContext.jsx` | UI theme management | Selected theme, theme list |
| `CurrencyContext.jsx` | Currency display | Display currency, exchange rates |

---

## 🔧 AuthContext.jsx

Manages user authentication state across the app.

### Exported

| Export | Type | Description |
|--------|------|-------------|
| `AuthProvider` | Component | Wraps app to provide auth state |
| `useAuth()` | Hook | Access auth state and functions |

### State

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `user` | `object \| null` | `null` | Current logged-in user |
| `loading` | `boolean` | `true` | Whether checking auth on startup |

### Functions (from useAuth)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `login` | `email, password` | `Promise<response>` | Logs in user, stores token, sets user state |
| `register` | `email, password, name` | `Promise<response>` | Creates new account |
| `logout` | - | `void` | Clears token and user state |

### How It Works

```
1. On app load: checkAuth() runs
2. Checks if token exists in localStorage
3. If yes, calls /api/profile to validate token
4. If valid, sets user state + loads saved theme
5. Components can use: const { user, login, logout } = useAuth()
```

### Usage Example

```jsx
function MyComponent() {
  const { user, login, logout } = useAuth();
  
  if (!user) return <LoginForm onSubmit={login} />;
  
  return (
    <div>
      <p>Welcome, {user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🔧 ThemeContext.jsx

Manages the app's visual theme with 12 themes (8 dark, 4 light).

### Exported

| Export | Type | Description |
|--------|------|-------------|
| `THEMES` | `Array` | List of all available themes |
| `ThemeProvider` | Component | Wraps app to provide theme state |
| `useTheme()` | Hook | Access theme state and functions |

### THEMES Array Structure

```javascript
{
  id: 'dark',        // CSS data-theme value
  name: 'Dark',      // Display name
  icon: '🌙',        // Emoji icon
  category: 'dark'   // 'dark' or 'light'
}
```

### Available Themes

| Dark Themes | Light Themes |
|-------------|--------------|
| 🌙 Dark | 💜 Lavender |
| ☕ Espresso | 🌸 Sakura |
| 🧛 Dracula | ☀️ Solarized |
| 🪵 Monokai | 🌤️ Light |
| 🤖 Cyberpunk | |
| 🌊 Ocean | |
| 🍵 Matcha | |
| 🌹 Rose Gold | |

### State

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `theme` | `string` | `'dark'` | Current theme ID |

### Functions (from useTheme)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `setTheme` | `themeId, syncToBackend=true` | `Promise<void>` | Changes theme, optionally syncs to server |
| `loadUserTheme` | `themeId` | `void` | Loads theme from user profile (called on login) |

### Values Provided

| Value | Type | Description |
|-------|------|-------------|
| `theme` | `string` | Current theme ID |
| `setTheme` | `function` | Change theme |
| `loadUserTheme` | `function` | Load saved theme |
| `currentTheme` | `object` | Full theme object (id, name, icon, category) |
| `themes` | `array` | All available themes |

### How It Works

```
1. On load: reads theme from localStorage (default: 'dark')
2. Applies theme: document.documentElement.setAttribute('data-theme', theme)
3. CSS uses [data-theme="dark"] selectors for theming
4. On change: saves to localStorage + optionally syncs to backend
5. On login: loadUserTheme() applies user's saved preference
```

---

## 🔧 CurrencyContext.jsx

Manages currency display - view amounts in any of 25 currencies.

### Exported

| Export | Type | Description |
|--------|------|-------------|
| `DISPLAY_CURRENCIES` | `Array` | List of 25 supported currencies |
| `CurrencyProvider` | Component | Wraps app to provide currency state |
| `useCurrency()` | Hook | Access currency state and functions |

### Currency Object Structure

```javascript
{
  code: 'USD',       // ISO currency code
  symbol: '$',       // Display symbol
  name: 'US Dollar'  // Full name
}
```

### Supported Currencies (25)

| Code | Symbol | Code | Symbol | Code | Symbol |
|------|--------|------|--------|------|--------|
| AUD | A$ | INR | ₹ | PLN | zł |
| BRL | R$ | JPY | ¥ | RUB | ₽ |
| CAD | C$ | KRW | ₩ | SEK | kr |
| CHF | Fr | MXN | $ | SGD | S$ |
| CNY | ¥ | NOK | kr | THB | ฿ |
| DKK | kr | NPR | रू | TRY | ₺ |
| EUR | € | NZD | NZ$ | UAH | ₴ |
| GBP | £ | | | USD | $ |
| HKD | HK$ | | | ZAR | R |

### State

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `displayCurrency` | `string` | `'EUR'` | Selected display currency |
| `rates` | `object` | `{}` | Exchange rates from EUR |
| `ratesLoading` | `boolean` | `false` | Whether fetching rates |

### Functions (from useCurrency)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `setDisplayCurrency` | `currencyCode` | `void` | Change display currency |
| `convertAmount` | `eurAmount` | `number` | Convert EUR to display currency |
| `formatAmount` | `eurAmount, options?` | `string` | Format amount with symbol |

### formatAmount Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showCode` | `boolean` | `false` | Include currency code (e.g., "$50.00 USD") |
| `decimals` | `number` | `2` | Decimal places |

### Values Provided

| Value | Type | Description |
|-------|------|-------------|
| `displayCurrency` | `string` | Current currency code |
| `setDisplayCurrency` | `function` | Change currency |
| `currentCurrency` | `object` | Full currency object |
| `currencies` | `array` | All 25 currencies |
| `convertAmount` | `function` | Convert EUR number |
| `formatAmount` | `function` | Format EUR to display string |
| `ratesLoading` | `boolean` | Loading state |
| `hasRate` | `boolean` | Whether rate is available |

### How It Works

```
1. On load: reads currency from localStorage (default: 'EUR')
2. If not EUR, fetches exchange rate from API
3. Rates cached in localStorage for 1 hour
4. formatAmount() converts EUR amounts to display currency
5. All amounts in DB are EUR - conversion is display-only
```

### Usage Example

```jsx
function ExpenseItem({ expense }) {
  const { formatAmount } = useCurrency();
  
  return (
    <div>
      <span>{expense.description}</span>
      <span>{formatAmount(expense.amount)}</span>
      {/* Shows: $50.00 (if USD selected) or €50.00 (if EUR) */}
    </div>
  );
}
```

---

## 🔄 Provider Hierarchy

In `App.jsx`:

```jsx
<ThemeProvider>       {/* Outermost - themes don't need auth */}
  <CurrencyProvider>  {/* Currency doesn't need auth either */}
    <AuthProvider>    {/* Auth uses theme context for loadUserTheme */}
      <App />
    </AuthProvider>
  </CurrencyProvider>
</ThemeProvider>
```

---

## 💡 Why Context?

| Without Context | With Context |
|-----------------|--------------|
| Pass `user` through 10 components | Any component: `useAuth()` |
| Prop drilling nightmare | Clean, direct access |
| Hard to maintain | Easy to extend |
