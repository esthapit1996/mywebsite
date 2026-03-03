// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  theme_preference?: string;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ============================================
// Group Types
// ============================================

export interface Group {
  id: number;
  name: string;
  description?: string;
  emoji?: string;
  created_by: number;
  members?: GroupMember[];
  created_at?: string;
}

export interface GroupMember {
  id: number;
  user_id: number;
  group_id: number;
  name: string;
  email: string;
  avatar?: string;
}

// ============================================
// Expense Types
// ============================================

export interface Expense {
  id: number;
  group_id: number;
  paid_by: number;
  paid_by_name?: string;
  amount: number;
  description: string;
  split_type: 'equal' | 'exact' | 'percentage';
  created_at: string;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  user_id: number;
  user_name?: string;
  amount: number;
}

export interface SplitWith {
  user_id: number;
  amount: number;
}

// ============================================
// Payment Types
// ============================================

export interface ExpensePayment {
  id: number;
  expense_id: number;
  paid_by: number;
  paid_by_name?: string;
  paid_to: number;
  paid_to_name?: string;
  amount: number;
  note?: string;
  created_at: string;
}

export interface PaymentStatus {
  totalOwed: number;
  totalPaid: number;
}

export interface PaymentStatusMap {
  [expenseId: number]: PaymentStatus;
}

export interface PaymentHistoryItem {
  id: number;
  type: 'settlement' | 'expense_payment';
  is_payer: boolean;
  other_user?: User;
  amount: number;
  group_name?: string;
  description?: string;
  created_at: string;
}

// ============================================
// Settlement Types
// ============================================

export interface Settlement {
  id: number;
  group_id: number;
  paid_by: number;
  paid_by_name?: string;
  paid_to: number;
  paid_to_name?: string;
  amount: number;
  created_at: string;
}

// ============================================
// Balance Types
// ============================================

export interface Balance {
  from_user: User;
  to_user: User;
  amount: number;
}

export interface BalancesResponse {
  balances: Balance[];
}

export interface MyBalanceResponse {
  balance: number;
}

export interface DebtOverviewItem {
  user: User;
  amount: number;
}

export interface DebtDetailItem {
  type: string;
  group_name: string;
  description: string;
  amount: number;
  created_at: string;
}

// ============================================
// Activity Types
// ============================================

export interface Activity {
  id: number;
  group_id: number;
  user_id: number;
  user_name?: string;
  action_type: string;
  description: string;
  created_at: string;
}

// ============================================
// Suggestion Types
// ============================================

export interface Suggestion {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  type: string;
  status?: 'open' | 'wip' | 'done' | 'denied';
  likes: number;
  dislikes: number;
  user_vote?: 'like' | 'dislike' | null;
  comment_count: number;
  created_at: string;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
  count: number;
  max: number;
}

export interface Voter {
  id: number;
  user_name: string;
  vote_type: 'like' | 'dislike';
}

export interface SuggestionComment {
  id: number;
  suggestion_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

// ============================================
// Currency Types
// ============================================

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export interface CurrencyRatesResponse {
  base: string;
  rates: Record<string, number>;
}

export interface CurrencyConvertResponse {
  from: string;
  to: string;
  amount: number;
  converted: number;
  rate: number;
}

export interface CurrencyHistoryResponse {
  from: string;
  to: string;
  history: CurrencyHistoryPoint[];
}

export interface CurrencyHistoryPoint {
  date: string;
  rate: number;
}

// ============================================
// Theme Types
// ============================================

export interface Theme {
  id: string;
  name: string;
  icon: string;
  category: 'dark' | 'light';
}

// ============================================
// Context Types
// ============================================

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<ApiResponse<LoginResponse>>;
  register: (email: string, password: string, name: string) => Promise<ApiResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface ThemeContextType {
  theme: string;
  setTheme: (theme: string, syncToBackend?: boolean) => Promise<void>;
  loadUserTheme: (userTheme: string) => void;
  currentTheme: Theme;
  themes: Theme[];
}

export interface CurrencyContextType {
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  currentCurrency: CurrencyInfo;
  currencies: CurrencyInfo[];
  convertAmount: (eurAmount: number) => number;
  formatAmount: (eurAmount: number, options?: FormatOptions) => string;
  ratesLoading: boolean;
  hasRate: boolean;
}

export interface FormatOptions {
  showCode?: boolean;
  decimals?: number;
}

// ============================================
// Access Control Types
// ============================================

export interface WhitelistEntry {
  id: number;
  email: string;
  added_by?: number;
  created_at: string;
}

export interface BlacklistEntry {
  id: number;
  email: string;
  reason: string;
  added_by?: number;
  created_at: string;
}
