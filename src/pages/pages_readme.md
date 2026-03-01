# 📄 Pages (`src/pages/`)

Pages are the main **route components** - each represents a full screen in the app.

---

## 📚 Libraries Used

| Library | Import | Purpose |
|---------|--------|---------|
| `react` | `useState, useEffect, useRef` | State and lifecycle hooks |
| `react-router-dom` | `useParams, useNavigate, Link` | Routing and navigation |
| `recharts` | `LineChart, Line, XAxis, ...` | Charts for currency history |
| `api` | `../services/api` | Backend API calls |
| `useAuth` | `../context/AuthContext` | Authentication state |
| `useCurrency` | `../context/CurrencyContext` | Currency formatting |

---

## 📁 Pages Overview

| Page | Route | Auth Required | Description |
|------|-------|---------------|-------------|
| `Login.jsx` | `/login` | ❌ | User login form |
| `Register.jsx` | `/register` | ❌ | User registration form |
| `Dashboard.jsx` | `/` | ✅ | Home - groups list, debt overview |
| `GroupDetail.jsx` | `/groups/:id` | ✅ | Single group - expenses, balances, settle |
| `PaymentHistory.jsx` | `/payment-history` | ✅ | User's payment history |
| `Suggestions.jsx` | `/suggestions` | ✅ | Feature suggestion box |
| `CurrencyConverter.jsx` | `/currency` | ✅ | Currency converter tool |

---

## 🔧 Login.jsx

Simple login form with email/password.

### State

| State | Type | Purpose |
|-------|------|---------|
| `email` | `string` | Email input value |
| `password` | `string` | Password input value |
| `error` | `string` | Error message to display |
| `loading` | `boolean` | Disable button while logging in |

### Flow

```
1. User enters email & password
2. Submit calls useAuth().login()
3. On success: redirect to /
4. On error: show error message
```

---

## 🔧 Register.jsx

Registration form with name, email, password.

### State

| State | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Name input |
| `email` | `string` | Email input |
| `password` | `string` | Password input |
| `confirmPassword` | `string` | Confirm password input |
| `error` | `string` | Error message |
| `success` | `string` | Success message |

### Validation

- Passwords must match
- Email must be whitelisted (backend check)

---

## 🔧 Dashboard.jsx

Main landing page after login.

### State

| State | Type | Purpose |
|-------|------|---------|
| `groups` | `array` | User's groups |
| `loading` | `boolean` | Initial load state |
| `showModal` | `boolean` | Create group modal |
| `debtOverview` | `array` | Who owes whom summary |
| `newGroupName` | `string` | New group form |
| `newGroupDesc` | `string` | New group description |
| `newGroupEmoji` | `string` | Selected emoji |

### Features

| Feature | Description |
|---------|-------------|
| **Debt Overview** | Shows total debts across all groups |
| **Groups List** | All groups user belongs to with balance indicator |
| **Create Group** | Modal with name, description, emoji picker, member selection |

### Key Functions

| Function | Description |
|----------|-------------|
| `loadGroups()` | Fetches user's groups from API |
| `loadDebtOverview()` | Fetches overall debt summary |
| `handleCreateGroup()` | Creates new group with selected members |

---

## 🔧 GroupDetail.jsx

The most complex page - manages a single group's expenses.

### URL Parameter

- `:id` - Group ID from URL

### State (simplified)

| State | Type | Purpose |
|-------|------|---------|
| `group` | `object` | Group details with members |
| `expenses` | `array` | All expenses in group |
| `balances` | `array` | Who owes whom |
| `myBalance` | `number` | Current user's balance |
| `activeTab` | `string` | 'expenses' \| 'balances' \| 'history' |
| `activities` | `array` | Activity feed |

### Modals

| Modal | Purpose |
|-------|---------|
| `showExpenseModal` | Add new expense |
| `showSettleModal` | Record a settlement |
| `showMemberModal` | Add member to group |
| `showExpenseDetailModal` | View expense + record payments |

### Expense Form State

| State | Type | Purpose |
|-------|------|---------|
| `expenseAmount` | `string` | Amount input |
| `expenseDesc` | `string` | Description |
| `splitType` | `string` | 'equal' \| 'percentage' |
| `expenseCurrency` | `string` | Input currency (converted to EUR) |
| `memberSplits` | `object` | Custom split percentages |

### Tab Content

| Tab | Content |
|-----|---------|
| **Expenses** | List of all expenses with payer, amount, description |
| **Balances** | Who owes whom in this group |
| **History** | Activity feed (settlements, expenses, etc.) |

### Key Functions

| Function | Description |
|----------|-------------|
| `loadData()` | Parallel fetch: group, expenses, balances, activities |
| `handleAddExpense()` | Creates expense with splits |
| `handleSettlement()` | Records direct payment |
| `handlePayment()` | Records partial expense payment |

---

## 🔧 PaymentHistory.jsx

Shows all payments the user has made or received.

### State

| State | Type | Purpose |
|-------|------|---------|
| `payments` | `array` | Payment history items |
| `loading` | `boolean` | Loading state |
| `error` | `string` | Error message |

### Payment Types Shown

- Expense payments (partial repayments)
- Settlements (direct payments)

---

## 🔧 Suggestions.jsx

Feature suggestion box with voting.

### State

| State | Type | Purpose |
|-------|------|---------|
| `suggestions` | `array` | All suggestions with vote counts |
| `newSuggestion` | `string` | New suggestion input |
| `loading` | `boolean` | Loading state |

### Features

| Feature | Description |
|---------|-------------|
| **Submit** | Users can submit up to 20 suggestions (800 chars each) |
| **Vote** | Upvote others' suggestions (anonymous) |
| **Delete** | Delete your own suggestions |
| **Status** | Admin can mark as planned/completed/rejected |

---

## 🔧 CurrencyConverter.jsx

Standalone currency converter with historical charts.

### State

| State | Type | Purpose |
|-------|------|---------|
| `amount` | `string` | Amount to convert |
| `fromCurrency` | `string` | Source currency |
| `toCurrency` | `string` | Target currency |
| `result` | `number` | Conversion result |
| `historyData` | `array` | Historical rate data |
| `historyPeriod` | `number` | 7, 30, 90, or 365 days |

### Features

| Feature | Description |
|---------|-------------|
| **Live Conversion** | Real-time conversion with live rates |
| **Swap** | Quick swap from/to currencies |
| **Trend Chart** | Historical rate chart (7D/1M/3M/1Y) |
| **25 Currencies** | Comprehensive currency support |

### Data Sources

| API | Purpose | Cache TTL |
|-----|---------|-----------|
| open.er-api.com | Live exchange rates | 1 hour |
| frankfurter.app | Historical rates | 24 hours |

---

## 🔄 Common Patterns

### Loading State Pattern

```jsx
if (loading) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}
```

### Error Handling Pattern

```jsx
try {
  const response = await api.someCall();
  setData(response.data);
} catch (err) {
  setError(err.message || 'Something went wrong');
}
```

### Form Submit Pattern

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    await api.createSomething(data);
    closeModal();
    refreshData();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Modal Pattern

```jsx
{showModal && (
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Title</h3>
        <button onClick={() => setShowModal(false)}>×</button>
      </div>
      <div className="modal-body">
        {/* Content */}
      </div>
      <div className="modal-footer">
        <button onClick={() => setShowModal(false)}>Cancel</button>
        <button onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  </div>
)}
```

---

## 🎨 Styling

All pages use CSS classes from `index.css`:

| Class | Purpose |
|-------|---------|
| `.container` | Page wrapper with max-width |
| `.card` | Content cards with shadows |
| `.form-group` | Form field wrapper |
| `.form-input` | Text inputs |
| `.form-select` | Dropdown selects |
| `.btn` | Buttons (primary, secondary, danger) |
| `.modal-overlay` | Modal background |
| `.modal` | Modal container |
| `.alert` | Error/success messages |
| `.empty-state` | "No data" placeholders |
