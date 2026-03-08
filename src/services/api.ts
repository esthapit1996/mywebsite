import type {
  ApiResponse,
  User,
  LoginResponse,
  Group,
  Expense,
  ExpensePayment,
  PaymentHistoryItem,
  Settlement,
  BalancesResponse,
  MyBalanceResponse,
  DebtOverviewItem,
  DebtDetailItem,
  Activity,
  Suggestion,
  SuggestionsResponse,
  Voter,
  SuggestionComment,
  CurrencyRatesResponse,
  CurrencyConvertResponse,
  CurrencyHistoryResponse,
  SplitWith,
  WhitelistEntry,
  BlacklistEntry,
  StashExpense,
  StashSummary,
} from '../types';

// API Configuration
// Uses production URL on deployed site, localhost for development
const API_BASE = import.meta.env.PROD 
  ? 'https://gopherdebt-api.fly.dev/api'
  : 'http://localhost:8080/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  clearToken(): void {
    localStorage.removeItem('token');
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
      });
    } catch (err) {
      // Network error — server unreachable, DNS failure, CORS blocked, etc.
      throw new Error('Unable to reach the server. Please check your connection and try again.');
    }

    // Handle 401 — token expired or invalid
    if (response.status === 401) {
      this.clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Session expired. Please log in again.');
    }

    // Try to parse the response as JSON
    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      // Non-JSON response — Render 502/504 HTML pages, etc.
      if (response.status >= 500) {
        throw new Error('Server is temporarily unavailable. Please try again in a moment.');
      }
      throw new Error(`Unexpected response (${response.status}). Please try again.`);
    }

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  }

  // Auth
  async register(email: string, password: string, name: string): Promise<ApiResponse> {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    return response;
  }

  logout(): void {
    this.clearToken();
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.request<User>('/profile');
  }

  async updateTheme(theme: string): Promise<ApiResponse> {
    return this.request('/profile/theme', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    });
  }

  async updateAvatar(avatar: string): Promise<ApiResponse> {
    return this.request('/profile/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    });
  }

  async updateLanguage(language: string): Promise<ApiResponse> {
    return this.request('/profile/language', {
      method: 'PUT',
      body: JSON.stringify({ language }),
    });
  }

  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse> {
    return this.request('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword }),
    });
  }

  async getAllUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>('/users');
  }

  async deleteUser(userId: number): Promise<ApiResponse> {
    return this.request(`/users/${userId}`, { method: 'DELETE' });
  }

  async getDebtOverview(): Promise<ApiResponse<DebtOverviewItem[]>> {
    return this.request<DebtOverviewItem[]>('/debt-overview');
  }

  async getDebtDetails(userId: number): Promise<ApiResponse<DebtDetailItem[]>> {
    return this.request<DebtDetailItem[]>(`/debt-overview/${userId}`);
  }

  async getPaymentHistory(): Promise<ApiResponse<PaymentHistoryItem[]>> {
    return this.request<PaymentHistoryItem[]>('/payment-history');
  }

  async clearPaymentHistory(): Promise<ApiResponse> {
    return this.request('/payment-history', { method: 'DELETE' });
  }

  // Groups
  async createGroup(name: string, description: string, emoji: string = '💰'): Promise<ApiResponse<Group>> {
    return this.request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, emoji }),
    });
  }

  async getGroups(): Promise<ApiResponse<Group[]>> {
    return this.request<Group[]>('/groups');
  }

  async getGroup(groupId: number | string): Promise<ApiResponse<Group>> {
    return this.request<Group>(`/groups/${groupId}`);
  }

  async deleteGroup(groupId: number | string): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async updateGroup(groupId: number | string, name: string, description: string): Promise<ApiResponse<Group>> {
    return this.request<Group>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
  }

  async addMember(groupId: number | string, userId: number): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async removeMember(groupId: number | string, memberId: number): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Expenses
  async createExpense(
    groupId: number | string,
    amount: number | string,
    description: string,
    splitType: string,
    splitWith: SplitWith[] = [],
    paidBy?: number
  ): Promise<ApiResponse<Expense>> {
    const body: Record<string, unknown> = {
      amount: parseFloat(String(amount)),
      description,
      split_type: splitType,
      split_with: splitWith,
    };
    if (paidBy) {
      body.paid_by = paidBy;
    }
    return this.request<Expense>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getExpenses(groupId: number | string): Promise<ApiResponse<Expense[]>> {
    return this.request<Expense[]>(`/groups/${groupId}/expenses`);
  }

  async getUnpaidExpenses(groupId: number | string): Promise<ApiResponse<Expense[]>> {
    return this.request<Expense[]>(`/groups/${groupId}/expenses/unpaid`);
  }

  async getExpense(groupId: number | string, expenseId: number | string): Promise<ApiResponse<Expense>> {
    return this.request<Expense>(`/groups/${groupId}/expenses/${expenseId}`);
  }

  async updateExpense(
    groupId: number | string,
    expenseId: number | string,
    amount: number | string,
    description: string,
    splitType: string,
    splitWith: SplitWith[] = [],
    paidBy?: number
  ): Promise<ApiResponse<Expense>> {
    const body: Record<string, unknown> = {
      amount: parseFloat(String(amount)),
      description,
      split_type: splitType,
      split_with: splitWith,
    };
    if (paidBy) body.paid_by = paidBy;
    return this.request<Expense>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteExpense(groupId: number | string, expenseId: number | string): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
  }

  async clearAllExpenses(groupId: number | string): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/expenses`, {
      method: 'DELETE',
    });
  }

  // Expense Payments (partial repayments)
  async getExpensePayments(expenseId: number | string): Promise<ApiResponse<ExpensePayment[]>> {
    return this.request<ExpensePayment[]>(`/expenses/${expenseId}/payments`);
  }

  async getGroupExpensePaymentStatuses(groupId: number | string): Promise<ApiResponse<Record<number, { total_owed: number; total_paid: number }>>> {
    return this.request<Record<number, { total_owed: number; total_paid: number }>>(`/groups/${groupId}/expense-payment-statuses`);
  }

  async createExpensePayment(expenseId: number | string, amount: number | string, note: string = ''): Promise<ApiResponse<ExpensePayment>> {
    return this.request<ExpensePayment>(`/expenses/${expenseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: parseFloat(String(amount)),
        note,
      }),
    });
  }

  async deleteExpensePayment(paymentId: number | string): Promise<ApiResponse> {
    return this.request(`/payments/${paymentId}`, {
      method: 'DELETE',
    });
  }

  // Settlements
  async createSettlement(groupId: number | string, paidTo: number, amount: number | string): Promise<ApiResponse<Settlement>> {
    return this.request<Settlement>(`/groups/${groupId}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        paid_to: paidTo,
        amount: parseFloat(String(amount)),
      }),
    });
  }

  async getSettlements(groupId: number | string): Promise<ApiResponse<Settlement[]>> {
    return this.request<Settlement[]>(`/groups/${groupId}/settlements`);
  }

  async deleteSettlement(groupId: number | string, settlementId: number | string): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/settlements/${settlementId}`, {
      method: 'DELETE',
    });
  }

  // Balances
  async getGroupBalances(groupId: number | string): Promise<ApiResponse<BalancesResponse>> {
    return this.request<BalancesResponse>(`/groups/${groupId}/balances`);
  }

  async getMyBalance(groupId: number | string): Promise<ApiResponse<MyBalanceResponse>> {
    return this.request<MyBalanceResponse>(`/groups/${groupId}/my-balance`);
  }

  // Activity history
  async getGroupActivities(groupId: number | string, limit: number = 50): Promise<ApiResponse<Activity[]>> {
    return this.request<Activity[]>(`/groups/${groupId}/activities?limit=${limit}`);
  }

  // Suggestions
  async getSuggestions(): Promise<ApiResponse<SuggestionsResponse>> {
    return this.request<SuggestionsResponse>('/suggestions');
  }

  async createSuggestion(content: string, type: string = 'other'): Promise<ApiResponse<Suggestion>> {
    return this.request<Suggestion>('/suggestions', {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
  }

  async deleteSuggestion(suggestionId: number | string): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}`, {
      method: 'DELETE',
    });
  }

  async editSuggestion(suggestionId: number | string, content: string, type: string): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}`, {
      method: 'PUT',
      body: JSON.stringify({ content, type }),
    });
  }

  async voteSuggestion(suggestionId: number | string, voteType: 'like' | 'dislike'): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    });
  }

  async removeVote(suggestionId: number | string): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}/vote`, {
      method: 'DELETE',
    });
  }

  async getSuggestionVoters(suggestionId: number | string): Promise<ApiResponse<Voter[]>> {
    return this.request<Voter[]>(`/suggestions/${suggestionId}/voters`);
  }

  async updateSuggestionStatus(suggestionId: number | string, status: string): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getSuggestionComments(suggestionId: number | string): Promise<ApiResponse<SuggestionComment[]>> {
    return this.request<SuggestionComment[]>(`/suggestions/${suggestionId}/comments`);
  }

  async createSuggestionComment(suggestionId: number | string, content: string): Promise<ApiResponse<SuggestionComment>> {
    return this.request<SuggestionComment>(`/suggestions/${suggestionId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteSuggestionComment(suggestionId: number | string, commentId: number): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async editSuggestionComment(suggestionId: number | string, commentId: number, content: string): Promise<ApiResponse> {
    return this.request(`/suggestions/${suggestionId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // Currency
  async getCurrencyRates(base: string = 'USD'): Promise<ApiResponse<CurrencyRatesResponse>> {
    return this.request<CurrencyRatesResponse>(`/currency/rates?base=${base}`);
  }

  async convertCurrency(from: string, to: string, amount: number | string): Promise<CurrencyConvertResponse> {
    const response = await this.request<CurrencyConvertResponse>(`/currency/convert?from=${from}&to=${to}&amount=${amount}`);
    return response as unknown as CurrencyConvertResponse;
  }

  async getCurrencyHistory(from: string, to: string, days: number = 7): Promise<CurrencyHistoryResponse> {
    const response = await this.request<CurrencyHistoryResponse>(`/currency/history?from=${from}&to=${to}&days=${days}`);
    return response as unknown as CurrencyHistoryResponse;
  }

  // Access Control (Whitelist/Blacklist)
  async getWhitelist(): Promise<ApiResponse<WhitelistEntry[]>> {
    return this.request<WhitelistEntry[]>('/whitelist');
  }

  async addToWhitelist(email: string): Promise<ApiResponse<WhitelistEntry>> {
    return this.request<WhitelistEntry>('/whitelist', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async removeFromWhitelist(id: number): Promise<ApiResponse> {
    return this.request(`/whitelist/${id}`, { method: 'DELETE' });
  }

  async getBlacklist(): Promise<ApiResponse<BlacklistEntry[]>> {
    return this.request<BlacklistEntry[]>('/blacklist');
  }

  async addToBlacklist(email: string, reason?: string): Promise<ApiResponse<BlacklistEntry>> {
    return this.request<BlacklistEntry>('/blacklist', {
      method: 'POST',
      body: JSON.stringify({ email, reason: reason || '' }),
    });
  }

  async removeFromBlacklist(id: number): Promise<ApiResponse> {
    return this.request(`/blacklist/${id}`, { method: 'DELETE' });
  }

  // GopherStash (personal expense tracker)
  async getStashExpenses(): Promise<ApiResponse<StashExpense[]>> {
    return this.request<StashExpense[]>('/stash');
  }

  async createStashExpense(amount: number, description: string, category: string = ''): Promise<ApiResponse<StashExpense>> {
    return this.request<StashExpense>('/stash', {
      method: 'POST',
      body: JSON.stringify({ amount, description, category }),
    });
  }

  async deleteStashExpense(id: number): Promise<ApiResponse> {
    return this.request(`/stash/${id}`, { method: 'DELETE' });
  }

  async getStashSummary(): Promise<ApiResponse<StashSummary>> {
    return this.request<StashSummary>('/stash/summary');
  }

  async clearStashExpenses(): Promise<ApiResponse> {
    return this.request('/stash', { method: 'DELETE' });
  }
}

export const api = new ApiService();
export default api;
