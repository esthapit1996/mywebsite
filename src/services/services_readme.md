# 🌐 Services (`src/services/`)

Services handle communication with external APIs (primarily our backend).

---

## 📚 Libraries Used

| Library | Import | Purpose |
|---------|--------|---------|
| `fetch` | Built-in | HTTP requests to backend |

---

## 📁 Files

| File | Purpose |
|------|---------|
| `api.js` | API client for all backend communication |

---

## 🔧 api.js

A class-based API client that handles all HTTP requests to the backend.

### Configuration

```javascript
const API_BASE = 'http://localhost:8080/api';
```

Change this URL when deploying to production.

---

### Core Methods

| Method | Description |
|--------|-------------|
| `getToken()` | Gets JWT token from localStorage |
| `setToken(token)` | Saves JWT token to localStorage |
| `clearToken()` | Removes JWT token from localStorage |
| `request(endpoint, options)` | Base method for all API calls |

### request() Method

The core method that all other methods use:

```javascript
async request(endpoint, options = {}) {
  // 1. Build full URL
  const url = `${this.baseUrl}${endpoint}`;
  
  // 2. Set headers (Content-Type, Authorization)
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // 3. Make fetch request
  const response = await fetch(url, { ...options, headers });
  
  // 4. Parse JSON response
  const data = await response.json();
  
  // 5. Throw error if not OK
  if (!response.ok) throw new Error(data.error);
  
  return data;
}
```

---

### Authentication Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `register` | `email, password, name` | POST | `/register` | Create new account |
| `login` | `email, password` | POST | `/login` | Login and store token |
| `logout` | - | - | - | Clear stored token (local only) |
| `getProfile` | - | GET | `/profile` | Get current user info |
| `updateTheme` | `theme` | PUT | `/profile/theme` | Update theme preference |

---

### User Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getAllUsers` | - | GET | `/users` | List all users |
| `getDebtOverview` | - | GET | `/debt-overview` | User's debts across groups |
| `getPaymentHistory` | - | GET | `/payment-history` | User's payment history |
| `clearPaymentHistory` | - | DELETE | `/payment-history` | Clear payment history |

---

### Group Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `createGroup` | `name, description, emoji` | POST | `/groups` | Create new group |
| `getGroups` | - | GET | `/groups` | List user's groups |
| `getGroup` | `groupId` | GET | `/groups/:id` | Get single group |
| `deleteGroup` | `groupId` | DELETE | `/groups/:id` | Delete group |
| `addMember` | `groupId, userId` | POST | `/groups/:id/members` | Add user to group |
| `removeMember` | `groupId, memberId` | DELETE | `/groups/:id/members/:id` | Remove user |

---

### Expense Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `createExpense` | `groupId, amount, description, splitType, splitWith` | POST | `/groups/:id/expenses` | Create expense |
| `getExpenses` | `groupId` | GET | `/groups/:id/expenses` | List group expenses |
| `getExpense` | `groupId, expenseId` | GET | `/groups/:id/expenses/:id` | Get single expense |
| `deleteExpense` | `groupId, expenseId` | DELETE | `/groups/:id/expenses/:id` | Delete expense |

### createExpense Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `groupId` | `number` | Group ID |
| `amount` | `number` | Expense amount (auto-parsed to float) |
| `description` | `string` | What the expense was for |
| `splitType` | `string` | 'equal', 'exact', or 'percentage' |
| `splitWith` | `array` | For custom splits: `[{user_id, amount}]` |

---

### Expense Payment Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getExpensePayments` | `expenseId` | GET | `/expenses/:id/payments` | List payments on expense |
| `createExpensePayment` | `expenseId, amount, note` | POST | `/expenses/:id/payments` | Record payment |
| `deleteExpensePayment` | `paymentId` | DELETE | `/payments/:id` | Delete payment |
| `getGroupExpensePaymentStatuses` | `groupId` | GET | `/groups/:id/expense-payment-statuses` | Batch: payment status for all expenses |

---

### Settlement Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `createSettlement` | `groupId, paidTo, amount` | POST | `/groups/:id/settlements` | Record direct payment |
| `getSettlements` | `groupId` | GET | `/groups/:id/settlements` | List group settlements |

---

### Balance Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getGroupBalances` | `groupId` | GET | `/groups/:id/balances` | Who owes whom in group |
| `getMyBalance` | `groupId` | GET | `/groups/:id/my-balance` | User's balance in group |

---

### Activity Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getGroupActivities` | `groupId, limit=50` | GET | `/groups/:id/activities` | Group activity feed |

---

### Suggestion Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getSuggestions` | - | GET | `/suggestions` | List all suggestions |
| `createSuggestion` | `content` | POST | `/suggestions` | Submit suggestion |
| `deleteSuggestion` | `suggestionId` | DELETE | `/suggestions/:id` | Delete own suggestion |
| `voteSuggestion` | `suggestionId, voteType` | POST | `/suggestions/:id/vote` | Vote on suggestion |
| `removeVote` | `suggestionId` | DELETE | `/suggestions/:id/vote` | Remove vote |
| `getSuggestionVoters` | `suggestionId` | GET | `/suggestions/:id/voters` | Get voter list |
| `updateSuggestionStatus` | `suggestionId, status` | PUT | `/suggestions/:id/status` | Update status (admin) |

---

### Currency Methods

| Method | Parameters | HTTP | Endpoint | Description |
|--------|------------|------|----------|-------------|
| `getCurrencyRates` | `base='USD'` | GET | `/currency/rates` | Get exchange rates |
| `convertCurrency` | `from, to, amount` | GET | `/currency/convert` | Convert amount |
| `getCurrencyHistory` | `from, to, days=7` | GET | `/currency/history` | Historical rates |

---

## 📤 Response Format

All API responses follow this structure:

```javascript
{
  success: true,          // or false
  data: { ... },          // response payload
  message: "Success!",    // optional success message
  error: "Error message"  // only if success is false
}
```

---

## 🔄 Usage Pattern

```javascript
import api from '../services/api';

// In a component:
const loadGroups = async () => {
  try {
    const response = await api.getGroups();
    setGroups(response.data || []);
  } catch (err) {
    setError(err.message);
  }
};
```

---

## 🔐 Authentication Flow

```
1. User logs in: api.login(email, password)
2. Token saved: localStorage.setItem('token', token)
3. All future requests: Authorization: Bearer <token>
4. On logout: api.logout() → clears token
```

---

## 🚨 Error Handling

The `request()` method throws errors for non-OK responses:

```javascript
if (!response.ok) {
  throw new Error(data.error || 'Something went wrong');
}
```

Callers should wrap API calls in try/catch:

```javascript
try {
  await api.createExpense(groupId, amount, desc, 'equal');
} catch (err) {
  // err.message contains the error from backend
  setError(err.message);
}
```

---

## 📦 Export

```javascript
export const api = new ApiService();
export default api;
```

Both named and default exports are available:

```javascript
import api from '../services/api';        // default
import { api } from '../services/api';    // named
```
