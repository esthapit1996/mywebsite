// API Configuration
// Change this to your backend URL when deployed
const API_BASE = 'http://localhost:8080/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  setToken(token) {
    localStorage.setItem('token', token);
  }

  clearToken() {
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  }

  // Auth
  async register(email, password, name) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email, password) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    return response;
  }

  logout() {
    this.clearToken();
  }

  async getProfile() {
    return this.request('/profile');
  }

  async updateTheme(theme) {
    return this.request('/profile/theme', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    });
  }

  async getAllUsers() {
    return this.request('/users');
  }

  async getDebtOverview() {
    return this.request('/debt-overview');
  }

  async getPaymentHistory() {
    return this.request('/payment-history');
  }

  async clearPaymentHistory() {
    return this.request('/payment-history', { method: 'DELETE' });
  }

  // Groups
  async createGroup(name, description, emoji = '💰') {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, emoji }),
    });
  }

  async getGroups() {
    return this.request('/groups');
  }

  async getGroup(groupId) {
    return this.request(`/groups/${groupId}`);
  }

  async deleteGroup(groupId) {
    return this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async addMember(groupId, userId) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async removeMember(groupId, memberId) {
    return this.request(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Expenses
  async createExpense(groupId, amount, description, splitType, splitWith = []) {
    return this.request(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        amount: parseFloat(amount),
        description,
        split_type: splitType,
        split_with: splitWith,
      }),
    });
  }

  async getExpenses(groupId) {
    return this.request(`/groups/${groupId}/expenses`);
  }

  async getExpense(groupId, expenseId) {
    return this.request(`/groups/${groupId}/expenses/${expenseId}`);
  }

  async deleteExpense(groupId, expenseId) {
    return this.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
  }

  // Expense Payments (partial repayments)
  async getExpensePayments(expenseId) {
    return this.request(`/expenses/${expenseId}/payments`);
  }

  async getGroupExpensePaymentStatuses(groupId) {
    return this.request(`/groups/${groupId}/expense-payment-statuses`);
  }

  async createExpensePayment(expenseId, amount, note = '') {
    return this.request(`/expenses/${expenseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: parseFloat(amount),
        note,
      }),
    });
  }

  async deleteExpensePayment(paymentId) {
    return this.request(`/payments/${paymentId}`, {
      method: 'DELETE',
    });
  }

  // Settlements
  async createSettlement(groupId, paidTo, amount) {
    return this.request(`/groups/${groupId}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        paid_to: paidTo,
        amount: parseFloat(amount),
      }),
    });
  }

  async getSettlements(groupId) {
    return this.request(`/groups/${groupId}/settlements`);
  }

  // Balances
  async getGroupBalances(groupId) {
    return this.request(`/groups/${groupId}/balances`);
  }

  async getMyBalance(groupId) {
    return this.request(`/groups/${groupId}/my-balance`);
  }

  // Activity history
  async getGroupActivities(groupId, limit = 50) {
    return this.request(`/groups/${groupId}/activities?limit=${limit}`);
  }

  // Suggestions
  async getSuggestions() {
    return this.request('/suggestions');
  }

  async createSuggestion(content) {
    return this.request('/suggestions', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteSuggestion(suggestionId) {
    return this.request(`/suggestions/${suggestionId}`, {
      method: 'DELETE',
    });
  }

  async voteSuggestion(suggestionId, voteType) {
    return this.request(`/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    });
  }

  async removeVote(suggestionId) {
    return this.request(`/suggestions/${suggestionId}/vote`, {
      method: 'DELETE',
    });
  }

  async getSuggestionVoters(suggestionId) {
    return this.request(`/suggestions/${suggestionId}/voters`);
  }

  async updateSuggestionStatus(suggestionId, status) {
    return this.request(`/suggestions/${suggestionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Currency
  async getCurrencyRates(base = 'USD') {
    return this.request(`/currency/rates?base=${base}`);
  }

  async convertCurrency(from, to, amount) {
    return this.request(`/currency/convert?from=${from}&to=${to}&amount=${amount}`);
  }

  async getCurrencyHistory(from, to, days = 7) {
    return this.request(`/currency/history?from=${from}&to=${to}&days=${days}`);
  }
}

export const api = new ApiService();
export default api;
