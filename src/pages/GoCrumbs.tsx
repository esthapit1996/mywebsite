import { memo, useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MoneyInput, { parseMoney } from '../components/MoneyInput';
import {
  BUNDESLAENDER,
  CALC_DEBOUNCE_MS,
  DEFAULT_BUNDESLAND,
  DEFAULT_ZUSATZBEITRAG,
  GOCRUMBS_ROUTE,
  MAX_CHILDREN,
  MAX_EXPENSE_AMOUNT,
  MAX_EXPENSE_LINES,
  MAX_EXTRA_PAY_LINES,
  MAX_GROSS_MONTH,
  MAX_GROSS_YEAR,
  MAX_PAGE_NAME,
  MAX_PAGES,
  MAX_SIDE_GROSS,
  MAX_WS_HOURS_MONTH,
  MAX_WS_HOURS_WEEK,
  MAX_WS_WAGE,
  WEEKS_PER_MONTH,
  WS_WEEKLY_HOURS_LIMIT,
  MAX_ZUSATZBEITRAG,
  STEUERKLASSEN,
} from '../constants/gocrumbs';
import type { GoCrumbsExpenseLine, GoCrumbsExtraPayLine, GoCrumbsInput, GoCrumbsPageSummary, GoCrumbsResult } from '../types';

type WorkType = GoCrumbsInput['work_type'];
const WORK_TYPES: readonly WorkType[] = ['fte', 'werkstudent'];

// This feature is EUR-only and German: never run its amounts through the display-currency conversion
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

// ---- Form state: everything the user types stays a string until it is sent ----

interface LineForm {
  id: number;
  name: string;
  amount: string;
}

interface ExtraLineForm extends LineForm {
  taxFree: boolean;
}

interface FormState {
  workType: WorkType; // fixed per page
  gross: string;
  period: 'month' | 'year';
  side: string;
  wsWage: string;
  wsHours: string;
  wsPeriod: 'week' | 'month';
  steuerklasse: number;
  churchTax: boolean;
  bundesland: string;
  children: string;
  under23: boolean;
  zusatz: string;
  rent: string;
  savings: string;
  subs: LineForm[];
  custom: LineForm[];
  extra: ExtraLineForm[];
}

const emptyForm: FormState = {
  workType: 'fte',
  gross: '',
  period: 'month',
  side: '',
  wsWage: '',
  wsHours: '',
  wsPeriod: 'month',
  steuerklasse: 1,
  churchTax: false,
  bundesland: DEFAULT_BUNDESLAND,
  children: '0',
  under23: false,
  zusatz: DEFAULT_ZUSATZBEITRAG,
  rent: '',
  savings: '',
  subs: [],
  custom: [],
  extra: [],
};

let nextLineId = 1;
const newLine = (name = '', amount = ''): LineForm => ({ id: nextLineId++, name, amount });
const newExtraLine = (name = '', amount = '', taxFree = false): ExtraLineForm => ({ ...newLine(name, amount), taxFree });

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
// Whole cents, like the database stores them, so a result never shifts after saving and reloading
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (s: string, max: number) => clamp(cents(parseMoney(s) ?? 0), 0, max);
const toField = (n: number) => (n === 0 ? '' : String(n));

function childrenOf(f: FormState): number {
  return clamp(Math.trunc(Number(f.children) || 0), 0, MAX_CHILDREN);
}

// Lines the user left completely empty are dropped
const keepLine = (l: LineForm) => l.name.trim() !== '' || money(l.amount, MAX_EXPENSE_AMOUNT) > 0;

function linesToInput(lines: LineForm[]): GoCrumbsExpenseLine[] {
  return lines
    .filter(keepLine)
    .map(l => ({ name: l.name.trim(), amount: money(l.amount, MAX_EXPENSE_AMOUNT), category: '' }));
}

function extraToInput(lines: ExtraLineForm[]): GoCrumbsExtraPayLine[] {
  return lines
    .filter(keepLine)
    .map(l => ({ name: l.name.trim(), amount: money(l.amount, MAX_EXPENSE_AMOUNT), tax_free: l.taxFree }));
}

function formToInput(f: FormState): GoCrumbsInput {
  return {
    work_type: f.workType,
    gross_amount: money(f.gross, f.period === 'month' ? MAX_GROSS_MONTH : MAX_GROSS_YEAR),
    gross_period: f.period,
    side_gross: money(f.side, MAX_SIDE_GROSS),
    ws_hourly_wage: money(f.wsWage, MAX_WS_WAGE),
    ws_hours: money(f.wsHours, f.wsPeriod === 'week' ? MAX_WS_HOURS_WEEK : MAX_WS_HOURS_MONTH),
    ws_hours_period: f.wsPeriod,
    steuerklasse: f.steuerklasse,
    church_tax: f.churchTax,
    bundesland: f.bundesland,
    children: childrenOf(f),
    under_23: f.under23,
    zusatzbeitrag: money(f.zusatz, MAX_ZUSATZBEITRAG),
    rent: money(f.rent, MAX_EXPENSE_AMOUNT),
    savings: money(f.savings, MAX_EXPENSE_AMOUNT),
    subscriptions: linesToInput(f.subs),
    custom_expenses: linesToInput(f.custom),
    // Extra pay is hidden for a Werkstudent: a line without a name can't be saved and must not
    // fail the request there. Named lines are kept for switching back.
    extra_pay: extraToInput(f.workType === 'fte' ? f.extra : f.extra.filter(l => l.name.trim() !== '')),
  };
}

// Hours of an average month (weekly hours count as 52 / 12 weeks)
const monthlyHours = (hours: number, period: 'week' | 'month') => (period === 'week' ? hours * WEEKS_PER_MONTH : hours);

// A Werkstudent's gross per month: hourly wage x hours, in whole cents like the API
const wsMonthlyGross = (i: GoCrumbsInput) => Math.round(i.ws_hourly_wage * monthlyHours(i.ws_hours, i.ws_hours_period) * 100) / 100;

// Only the income of the chosen work type counts; the other one stays saved untouched
const hasIncome = (i: GoCrumbsInput) => (i.work_type === 'werkstudent' ? wsMonthlyGross(i) > 0 : i.gross_amount > 0);

function inputToForm(p: GoCrumbsInput): FormState {
  const lines = (list: GoCrumbsExpenseLine[]) => list.map(l => newLine(l.name, toField(l.amount)));
  return {
    workType: p.work_type,
    gross: toField(p.gross_amount),
    period: p.gross_period,
    side: toField(p.side_gross),
    wsWage: toField(p.ws_hourly_wage ?? 0),
    wsHours: toField(p.ws_hours ?? 0),
    wsPeriod: p.ws_hours_period ?? 'month',
    steuerklasse: p.steuerklasse,
    churchTax: p.church_tax,
    bundesland: p.bundesland,
    children: String(p.children),
    under23: p.under_23,
    zusatz: String(p.zusatzbeitrag),
    rent: toField(p.rent),
    savings: toField(p.savings),
    subs: lines(p.subscriptions),
    custom: lines(p.custom_expenses),
    extra: (p.extra_pay ?? []).map(l => newExtraLine(l.name, toField(l.amount), l.tax_free)),
  };
}

// The page to open for a work type: the one saved most recently
function latestPage(pages: GoCrumbsPageSummary[]): GoCrumbsPageSummary | undefined {
  let latest: GoCrumbsPageSummary | undefined;
  for (const p of pages) {
    if (!latest || Date.parse(p.updated_at) > Date.parse(latest.updated_at)) latest = p;
  }
  return latest;
}

const pagePath = (id: number) => `${GOCRUMBS_ROUTE}/${id}`;
const draftPath = (type: WorkType) => `${GOCRUMBS_ROUTE}?type=${type}`;

// An amount without a name can't be saved (the API requires a name)
const hasUnnamedAmount = (lines: LineForm[]) =>
  lines.some(l => l.name.trim() === '' && money(l.amount, MAX_EXPENSE_AMOUNT) > 0);

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const CHART_COLORS = { tax: '#ef4444', social: '#f97316', rent: '#3b82f6', savings: '#a855f7', other: '#eab308', left: '#10b981' };

function ResultRow({ label, value, bold, color, indent }: { label: string; value: string; bold?: boolean; color?: string; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0', paddingLeft: indent ? '12px' : 0, fontWeight: bold ? 700 : 400, color }}>
      <span style={{ color: bold || color ? undefined : 'var(--text-muted)' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface StableSelectProps {
  id: string;
  ariaLabel?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

const sameSelect = (a: StableSelectProps, b: StableSelectProps) =>
  a.id === b.id &&
  a.ariaLabel === b.ariaLabel &&
  a.value === b.value &&
  a.options.length === b.options.length &&
  a.options.every((o, i) => o.value === b.options[i].value && o.label === b.options[i].label);

// A <select> that only re-renders when its own value or options change. React re-selects the
// current option of a controlled select on every render, and the page re-renders on every keystroke
// and twice per calculation; on an iPhone that closes a picker the user has just opened, so it
// needed 2-3 taps. onChange is left out of the comparison: callers must use functional state updates.
const StableSelect = memo(function StableSelect({ id, ariaLabel, value, options, onChange }: StableSelectProps) {
  return (
    <select id={id} className="form-select" aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}, sameSelect);

// The expense lines behind the "Expenses" total, shown when the row is opened
function ExpenseBreakdown({ input }: { input: GoCrumbsInput }) {
  const { t } = useTranslation();
  const row = (key: string, label: string, amount: number) =>
    amount > 0 && (
      <div key={key} className="gocrumbs-breakdown-row">
        <span>{label}</span>
        <span style={{ whiteSpace: 'nowrap' }}>− {eur.format(amount)}</span>
      </div>
    );
  const group = (title: string, lines: GoCrumbsExpenseLine[]) =>
    lines.some(l => l.amount > 0) && (
      <>
        <div className="gocrumbs-breakdown-group">{title}</div>
        {lines.map((l, i) => row(`${title}-${i}`, l.name, l.amount))}
      </>
    );
  return (
    <div className="gocrumbs-breakdown">
      {row('rent', t('gocrumbs.rent'), input.rent)}
      {row('savings', t('gocrumbs.savings'), input.savings)}
      {group(t('gocrumbs.subscriptions'), input.subscriptions)}
      {group(t('gocrumbs.custom'), input.custom_expenses)}
    </div>
  );
}

interface PageDialogProps {
  title: string;
  submitLabel: string;
  initialName: string;
  // New page only: start from a copy of the open page (with a hint when it has unsaved changes) or blank
  copyChoice?: { defaultCopy: boolean; hint: string | null };
  onSubmit: (name: string, copy: boolean) => Promise<void>;
  onClose: () => void;
}

// Asks for a page name (new page, rename, saving an unsaved budget). On success the caller closes it;
// on failure the server's message (name taken, 15 pages reached) is shown here.
function PageDialog({ title, submitLabel, initialName, copyChoice, onSubmit, onClose }: PageDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [copy, setCopy] = useState(copyChoice?.defaultCopy ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trimmed = name.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(trimmed, copy);
    } catch (err) {
      setError(errorMessage(err, t('gocrumbs.pages.failed')));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-content card" role="dialog" aria-modal="true" aria-labelledby="gc-page-dialog-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="gc-page-dialog-title">{title}</h2>
          <button type="button" className="modal-close" aria-label={t('common.cancel')} disabled={busy} onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="gc-page-name">{t('gocrumbs.pages.nameLabel')}</label>
            <input
              id="gc-page-name"
              className="form-input"
              type="text"
              maxLength={MAX_PAGE_NAME}
              value={name}
              placeholder={t('gocrumbs.pages.namePlaceholder')}
              autoFocus
              onChange={e => setName(e.target.value)}
            />
          </div>
          {copyChoice && (
            <div className="form-group gocrumbs-start" role="radiogroup" aria-label={t('gocrumbs.pages.startLabel')}>
              <label>
                <input type="radio" name="gc-page-start" checked={copy} onChange={() => setCopy(true)} />
                {t('gocrumbs.pages.copyCurrent')}
              </label>
              <label>
                <input type="radio" name="gc-page-start" checked={!copy} onChange={() => setCopy(false)} />
                {t('gocrumbs.pages.startBlank')}
              </label>
              {copy && copyChoice.hint && <small>{copyChoice.hint}</small>}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={!trimmed || busy}>
              {busy ? t('gocrumbs.saving') : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GoCrumbs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pageId: pageParam } = useParams();
  const [searchParams] = useSearchParams();
  // /gocrumbs/:pageId opens a saved page; /gocrumbs?type=... opens that work type's latest page, or an
  // unsaved budget when it has none yet
  const pageId = pageParam && /^\d+$/.test(pageParam) ? Number(pageParam) : null;
  const typeParam: WorkType | null = WORK_TYPES.find(w => w === searchParams.get('type')) ?? null;

  const [pages, setPages] = useState<GoCrumbsPageSummary[]>([]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageName, setPageName] = useState(''); // the open page's saved name; '' for an unsaved budget
  const [dialog, setDialog] = useState<'new' | 'rename' | 'saveDraft' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const allowNav = useRef(false); // set right before a navigation that must not ask about unsaved changes

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadError, setLoadError] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null); // last saved input as JSON; null = never saved
  const [result, setResult] = useState<GoCrumbsResult | null>(null);
  // The input the shown result was calculated from, so the expense breakdown always adds up to its total
  const [resultInput, setResultInput] = useState<GoCrumbsInput | null>(null);
  const [showExpenses, setShowExpenses] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const requestSeq = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const loading = pagesLoading || pageLoading;
  const openPage = pageId === null ? undefined : pages.find(p => p.id === pageId);
  const viewType: WorkType = openPage?.work_type ?? typeParam ?? 'fte';
  const typePages = pages.filter(p => p.work_type === viewType);
  const atLimit = typePages.length >= MAX_PAGES;
  const input = useMemo(() => formToInput(form), [form]);
  const inputKey = useMemo(() => JSON.stringify(input), [input]);
  // Extra pay only exists for employees, so a hidden line of it must not block anything
  const nameMissing = hasUnnamedAmount(form.subs) || hasUnnamedAmount(form.custom) || (form.workType === 'fte' && hasUnnamedAmount(form.extra));
  const lineCount = form.subs.length + form.custom.length;
  const children = childrenOf(form);
  const isEmployee = form.workType === 'fte';
  const showUnder23 = isEmployee && children === 0; // the care-insurance surcharge only exists for employees
  const weeklyHours = input.ws_hours_period === 'week' ? input.ws_hours : input.ws_hours / WEEKS_PER_MONTH;
  const incomeEntered = hasIncome(input);
  const dirty = savedKey === null ? incomeEntered : savedKey !== inputKey;
  const canSave = dirty && incomeEntered && !nameMissing && !saving;

  // Load the list of pages (the tabs) once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGoCrumbsPages();
        if (!cancelled) setPages(res.data ?? []);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, t('gocrumbs.loadFailed')));
      } finally {
        if (!cancelled) setPagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // Open what the URL names. A missing or foreign page goes back to /gocrumbs; without a page the
  // latest one (of the asked work type) opens, or an unsaved budget when there is none.
  useEffect(() => {
    if (pagesLoading) return;
    allowNav.current = false;
    const list = pagesRef.current;
    const clearResult = () => {
      setResult(null);
      setResultInput(null);
      setShowExpenses(false);
      setCalcError('');
      setSaveMsg(null);
    };
    const redirect = (to: string) => {
      allowNav.current = true; // the form is about to be replaced anyway
      navigate(to, { replace: true });
    };

    if (pageParam !== undefined) {
      if (pageId === null || !list.some(p => p.id === pageId)) {
        redirect(GOCRUMBS_ROUTE);
        return;
      }
      let cancelled = false;
      setPageLoading(true);
      setLoadError('');
      clearResult();
      (async () => {
        try {
          const res = await api.getGoCrumbsPage(pageId);
          if (cancelled || !res.data) return;
          const loaded = inputToForm(res.data);
          setForm(loaded);
          setSavedKey(JSON.stringify(formToInput(loaded)));
          setPageName(res.data.name);
        } catch (err) {
          if (!cancelled) setLoadError(errorMessage(err, t('gocrumbs.pages.loadFailed')));
        } finally {
          if (!cancelled) setPageLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }

    const latest = latestPage(typeParam ? list.filter(p => p.work_type === typeParam) : list);
    if (latest) {
      redirect(pagePath(latest.id));
      return;
    }
    setForm({ ...emptyForm, workType: typeParam ?? 'fte' });
    setSavedKey(null);
    setPageName('');
    clearResult();
  }, [pagesLoading, pageParam, pageId, typeParam, navigate, t]);

  // Recalculate shortly after the last edit. Each run cancels the previous request and the
  // sequence number drops answers from older requests, so a slow response can't overwrite a newer one.
  useEffect(() => {
    if (loading) return;
    if (!incomeEntered) {
      setResult(null);
      setCalcError('');
      setCalculating(false);
      return;
    }
    if (nameMissing) return;

    const mySeq = ++requestSeq.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCalculating(true);
      try {
        const res = await api.calculateGoCrumbs(input, controller.signal);
        if (controller.signal.aborted || mySeq !== requestSeq.current) return;
        setResult(res.data ?? null);
        setResultInput(input);
        setCalcError('');
      } catch (err) {
        if (controller.signal.aborted || mySeq !== requestSeq.current) return;
        setCalcError(errorMessage(err, t('gocrumbs.calcFailed')));
      } finally {
        if (!controller.signal.aborted && mySeq === requestSeq.current) setCalculating(false);
      }
    }, CALC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `input` changes exactly when `inputKey` does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, nameMissing, loading, t]);

  // Keep the open tab visible in the sideways-scrolling tab row (only the row scrolls, never the page)
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>('.gocrumbs-tab.active');
    if (!row || !tab) return;
    if (tab.offsetLeft < row.scrollLeft || tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    }
  }, [pageId, pages.length, pagesLoading]);

  // Ask before leaving the page or switching tabs inside the app (links, menu, back button) with unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allowNav.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('gocrumbs.leaveConfirm'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The "Saved" confirmation fades after a moment
  useEffect(() => {
    if (!saveMsg?.ok) return;
    const timer = setTimeout(() => setSaveMsg(null), 2500);
    return () => clearTimeout(timer);
  }, [saveMsg]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));

  const updateLine = (kind: 'subs' | 'custom', id: number, patch: Partial<LineForm>) =>
    setForm(f => ({ ...f, [kind]: f[kind].map(l => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = (kind: 'subs' | 'custom') =>
    setForm(f => (f.subs.length + f.custom.length >= MAX_EXPENSE_LINES ? f : { ...f, [kind]: [...f[kind], newLine()] }));
  const removeLine = (kind: 'subs' | 'custom', id: number) =>
    setForm(f => ({ ...f, [kind]: f[kind].filter(l => l.id !== id) }));

  const updateExtra = (id: number, patch: Partial<ExtraLineForm>) =>
    setForm(f => ({ ...f, extra: f.extra.map(l => (l.id === id ? { ...l, ...patch } : l)) }));
  const addExtra = () =>
    setForm(f => (f.extra.length >= MAX_EXTRA_PAY_LINES ? f : { ...f, extra: [...f.extra, newExtraLine()] }));
  const removeExtra = (id: number) => setForm(f => ({ ...f, extra: f.extra.filter(l => l.id !== id) }));

  // Replace one tab's name and save time after the server confirmed a save
  const updateTab = (saved: GoCrumbsPageSummary) =>
    setPages(list => list.map(p => (p.id === saved.id ? { ...p, name: saved.name, updated_at: saved.updated_at } : p)));

  // An unsaved budget has no page yet: saving asks for a name and creates one
  const handleSave = async () => {
    if (pageId === null) {
      setDialog('saveDraft');
      return;
    }
    const id = pageId;
    const key = inputKey;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await api.saveGoCrumbsPage(id, { ...input, name: pageName });
      setSavedKey(key);
      if (res.data) updateTab(res.data);
      setSaveMsg({ ok: true, text: t('gocrumbs.saved') });
    } catch (err) {
      setSaveMsg({ ok: false, text: errorMessage(err, t('gocrumbs.saveFailed')) });
    } finally {
      setSaving(false);
    }
  };

  // Create a page and open it. `carried` means the form's content went into the new page, so leaving
  // this one must not ask about unsaved changes; a blank page asks as usual.
  const createPage = async (name: string, body: GoCrumbsInput, carried: boolean) => {
    const res = await api.createGoCrumbsPage({ ...body, name });
    const page = res.data;
    if (!page) throw new Error(t('gocrumbs.pages.failed'));
    setPages(list => [...list, { id: page.id, name: page.name, work_type: page.work_type, updated_at: page.updated_at }]);
    setDialog(null);
    if (carried) {
      if (pageId === null) setSavedKey(inputKey); // the unsaved budget is now that page
      allowNav.current = true;
    }
    navigate(pagePath(page.id));
  };

  const handleNewPage = (name: string, copy: boolean) =>
    createPage(name, copy ? input : formToInput({ ...emptyForm, workType: viewType }), copy);

  // Renaming keeps the last saved inputs: unsaved edits stay unsaved
  const handleRename = async (name: string) => {
    if (pageId === null || savedKey === null) return;
    const res = await api.saveGoCrumbsPage(pageId, { ...(JSON.parse(savedKey) as GoCrumbsInput), name });
    if (res.data) {
      updateTab(res.data);
      setPageName(res.data.name);
    }
    setDialog(null);
  };

  const handleDelete = async () => {
    if (pageId === null || !window.confirm(t('gocrumbs.pages.deleteConfirm', { name: pageName }))) return;
    setDeleting(true);
    try {
      await api.deleteGoCrumbsPage(pageId);
      const rest = pages.filter(p => p.id !== pageId);
      setPages(rest);
      const next = latestPage(rest.filter(p => p.work_type === viewType));
      allowNav.current = true;
      navigate(next ? pagePath(next.id) : draftPath(viewType), { replace: true });
    } catch (err) {
      setSaveMsg({ ok: false, text: errorMessage(err, t('gocrumbs.pages.deleteFailed')) });
    } finally {
      setDeleting(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    const e = result.expenses;
    const slices = [
      { key: 'tax', value: result.lohnsteuer + result.soli + result.kirchensteuer },
      { key: 'social', value: result.rv + result.av + result.kv + result.pv },
      { key: 'rent', value: e.rent },
      { key: 'savings', value: e.savings },
      { key: 'other', value: e.subscriptions + e.custom },
      { key: 'left', value: Math.max(result.left, 0) },
    ] as const;
    return slices
      .filter(s => s.value > 0.005)
      .map(s => ({ ...s, name: t(`gocrumbs.chart.${s.key}` as never), color: CHART_COLORS[s.key] }));
  }, [result, t]);

  if (pagesLoading) return <LoadingSpinner message={t('gocrumbs.loading')} />;

  const overspent = result !== null && result.left < 0;
  const leftColor = overspent ? 'var(--danger)' : 'var(--primary)';

  // Save status next to both Save buttons. It is inline on purpose: an alert above the form, or a
  // hint that wraps the header, would move every field on a phone just as the user taps the next one.
  // An error stays visible; "Saved" gives way to "unsaved" as soon as something changes again.
  const saveStatus = (
    <span className="gocrumbs-save-status" style={{ color: saveMsg && !saveMsg.ok ? 'var(--danger)' : saveMsg && !dirty ? 'var(--primary)' : 'var(--text-muted)' }}>
      {saveMsg && (!saveMsg.ok || !dirty) ? saveMsg.text : dirty ? t('gocrumbs.unsaved') : ''}
    </span>
  );

  const saveButton = (
    <button className="btn btn-primary" disabled={!canSave || loading || !!loadError} onClick={handleSave}>
      {saving ? t('gocrumbs.saving') : pageId === null ? t('gocrumbs.pages.saveAsPage') : t('gocrumbs.save')}
    </button>
  );

  const renderLines = (kind: 'subs' | 'custom', lines: LineForm[], addLabel: string) => (
    <>
      {lines.map(line => (
        <div key={line.id} className="gocrumbs-line">
          <input
            className="form-input"
            type="text"
            maxLength={60}
            value={line.name}
            placeholder={t('gocrumbs.namePlaceholder')}
            aria-label={t('gocrumbs.namePlaceholder')}
            onChange={e => updateLine(kind, line.id, { name: e.target.value })}
          />
          <MoneyInput value={line.amount} ariaLabel={t('gocrumbs.namePlaceholder')} onChange={v => updateLine(kind, line.id, { amount: v })} />
          <button type="button" className="btn btn-outline btn-sm" title={t('gocrumbs.remove')} aria-label={t('gocrumbs.remove')} onClick={() => removeLine(kind, line.id)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" disabled={lineCount >= MAX_EXPENSE_LINES} onClick={() => addLine(kind)}>
        + {addLabel}
      </button>
    </>
  );

  return (
    <div className="container gocrumbs-page">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('common.backToDashboard')}
        </Link>
      </div>

      <div className="card">
        <div className="card-header" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className="card-title">🧮 {t('gocrumbs.name')}</h2>
          <div className="gocrumbs-actions">
            {saveStatus}
            {saveButton}
          </div>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('gocrumbs.tagline')}</p>

        {/* Pages: each work type has its own tabs. A page's work type is fixed, so this switches lists. */}
        <div className="gocrumbs-types" role="group" aria-label={t('gocrumbs.workTitle')}>
          {WORK_TYPES.map(type => (
            <button
              key={type}
              type="button"
              className={`btn btn-sm ${viewType === type ? 'btn-primary' : 'btn-outline'}`}
              aria-pressed={viewType === type}
              onClick={() => { if (type !== viewType) navigate(draftPath(type)); }}
            >
              {t(`gocrumbs.workType.${type}`)} ({pages.filter(p => p.work_type === type).length})
            </button>
          ))}
        </div>
        {/* "+" sits outside the scrolling row, so it stays visible with many pages */}
        <div className="gocrumbs-tabbar">
          <div className="gocrumbs-tabs" role="tablist" aria-label={t('gocrumbs.pages.tabsLabel')} ref={tabsRef}>
            {typePages.map(p => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === pageId}
                className={`gocrumbs-tab${p.id === pageId ? ' active' : ''}`}
                onClick={() => { if (p.id !== pageId) navigate(pagePath(p.id)); }}
              >
                {p.name}
              </button>
            ))}
            {pageId === null && (
              <span role="tab" aria-selected="true" className="gocrumbs-tab active draft">{t('gocrumbs.pages.unsavedTab')}</span>
            )}
          </div>
          <button
            type="button"
            className="gocrumbs-tab gocrumbs-tab-add"
            disabled={atLimit}
            title={atLimit ? t('gocrumbs.pages.limitReached', { max: MAX_PAGES }) : t('gocrumbs.pages.new')}
            aria-label={t('gocrumbs.pages.new')}
            onClick={() => setDialog('new')}
          >
            +
          </button>
        </div>
        <div className="gocrumbs-tab-info">
          <span>
            {atLimit
              ? t('gocrumbs.pages.limitReached', { max: MAX_PAGES })
              : pageId === null
                ? t('gocrumbs.pages.draftHint')
                : t('gocrumbs.pages.count', { count: typePages.length, max: MAX_PAGES })}
          </span>
          {pageId !== null && (
            <span className="gocrumbs-tab-actions">
              <button type="button" className="btn btn-outline btn-sm" disabled={pageLoading || !!loadError} onClick={() => setDialog('rename')}>
                {t('gocrumbs.pages.rename')}
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={deleting} onClick={handleDelete}>
                {t('common.delete')}
              </button>
            </span>
          )}
        </div>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      {pageLoading ? (
        <LoadingSpinner message={t('gocrumbs.loading')} />
      ) : !loadError && (
      <div className="gocrumbs-layout">
        <div>
          {/* Income */}
          <div className="card">
            <h3>{t('gocrumbs.incomeTitle')}</h3>
            {form.workType === 'werkstudent' && (
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('gocrumbs.werkstudentInfo')}</p>
            )}
            {form.workType === 'werkstudent' ? (
              <>
                <div className="gocrumbs-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="gc-ws-wage">{t('gocrumbs.wsWage')}</label>
                    <MoneyInput id="gc-ws-wage" value={form.wsWage} onChange={v => set('wsWage', v)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="gc-ws-hours">{t('gocrumbs.wsHours')}</label>
                    <MoneyInput id="gc-ws-hours" value={form.wsHours} onChange={v => set('wsHours', v)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <StableSelect
                    id="gc-ws-period"
                    ariaLabel={t('gocrumbs.wsHoursPeriod')}
                    value={form.wsPeriod}
                    options={[{ value: 'month', label: t('gocrumbs.wsPerMonth') }, { value: 'week', label: t('gocrumbs.wsPerWeek') }]}
                    onChange={v => set('wsPeriod', v as 'week' | 'month')}
                  />
                  {incomeEntered && (
                    <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)' }}>
                      {t('gocrumbs.wsPreview', {
                        hours: monthlyHours(input.ws_hours, input.ws_hours_period).toLocaleString('de-DE', { maximumFractionDigits: 2 }),
                        wage: eur.format(input.ws_hourly_wage),
                        gross: eur.format(wsMonthlyGross(input)),
                      })}
                    </small>
                  )}
                  {weeklyHours > WS_WEEKLY_HOURS_LIMIT && (
                    <small style={{ display: 'block', marginTop: '8px', color: 'var(--danger)' }}>{t('gocrumbs.wsHoursWarning', { limit: WS_WEEKLY_HOURS_LIMIT })}</small>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="gocrumbs-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="gc-gross">{t('gocrumbs.gross')}</label>
                    <MoneyInput id="gc-gross" value={form.gross} onChange={v => set('gross', v)} />
                  </div>
                  <div className="form-group">
                    <StableSelect
                      id="gc-period"
                      ariaLabel={t('gocrumbs.grossPeriod')}
                      value={form.period}
                      options={[{ value: 'month', label: t('gocrumbs.perMonth') }, { value: 'year', label: t('gocrumbs.perYear') }]}
                      onChange={v => set('period', v as 'month' | 'year')}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="gc-side">{t('gocrumbs.side')}</label>
                  <MoneyInput id="gc-side" value={form.side} onChange={v => set('side', v)} />
                  <small style={{ color: 'var(--text-muted)' }}>{t('gocrumbs.sideHint')}</small>
                </div>
              </>
            )}
          </div>

          {/* Extra pay: flat monthly pay on top of the salary, e.g. on-call (employees only; kept when switching) */}
          {form.workType === 'fte' && (
            <div className="card">
              <h3>{t('gocrumbs.extraTitle')}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('gocrumbs.extraHint')}</p>
              {form.extra.map(line => (
                <div key={line.id} className="gocrumbs-extra">
                  <div className="gocrumbs-line">
                    <input
                      className="form-input"
                      type="text"
                      maxLength={60}
                      value={line.name}
                      placeholder={t('gocrumbs.extraPlaceholder')}
                      aria-label={t('gocrumbs.namePlaceholder')}
                      onChange={e => updateExtra(line.id, { name: e.target.value })}
                    />
                    <MoneyInput value={line.amount} ariaLabel={t('gocrumbs.namePlaceholder')} onChange={v => updateExtra(line.id, { amount: v })} />
                    <button type="button" className="btn btn-outline btn-sm" title={t('gocrumbs.remove')} aria-label={t('gocrumbs.remove')} onClick={() => removeExtra(line.id)}>
                      ×
                    </button>
                  </div>
                  <label className="gocrumbs-extra-free">
                    <input type="checkbox" checked={line.taxFree} onChange={e => updateExtra(line.id, { taxFree: e.target.checked })} />
                    {t('gocrumbs.extraTaxFree')}
                  </label>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" disabled={form.extra.length >= MAX_EXTRA_PAY_LINES} onClick={addExtra}>
                + {t('gocrumbs.addExtra')}
              </button>
            </div>
          )}

          {/* Tax settings */}
          <div className="card">
            <h3>{t('gocrumbs.taxTitle')}</h3>
            <div className="gocrumbs-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="gc-class">{t('gocrumbs.taxClass')}</label>
                <StableSelect
                  id="gc-class"
                  value={String(form.steuerklasse)}
                  options={STEUERKLASSEN.map(c => ({ value: String(c), label: t(`gocrumbs.classes.${c}` as never) }))}
                  onChange={v => set('steuerklasse', Number(v))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gc-state">{t('gocrumbs.bundesland')}</label>
                <StableSelect
                  id="gc-state"
                  value={form.bundesland}
                  options={BUNDESLAENDER.map(b => ({ value: b.code, label: b.name }))}
                  onChange={v => set('bundesland', v)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gc-children">{t('gocrumbs.children')}</label>
                <input
                  id="gc-children"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  value={form.children}
                  onChange={e => { if (/^\d{0,2}$/.test(e.target.value)) set('children', e.target.value); }}
                />
              </div>
              {/* Employees only: a Werkstudent pays no health or care insurance, so the additional rate
                  and the under-23 rule change nothing there. The saved values stay for switching back. */}
              {isEmployee && (
                <div className="form-group">
                  <label className="form-label" htmlFor="gc-zusatz">{t('gocrumbs.zusatzbeitrag')}</label>
                  <MoneyInput id="gc-zusatz" value={form.zusatz} onChange={v => set('zusatz', v)} />
                </div>
              )}
            </div>
            {isEmployee && <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '12px' }}>{t('gocrumbs.zusatzHint')}</small>}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: showUnder23 ? '10px' : 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.churchTax} onChange={e => set('churchTax', e.target.checked)} />
              {t('gocrumbs.churchTax')}
            </label>
            {showUnder23 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.under23} onChange={e => set('under23', e.target.checked)} />
                {t('gocrumbs.under23')}
              </label>
            )}
          </div>

          {/* Monthly expenses */}
          <div className="card">
            <h3>{t('gocrumbs.expensesTitle')}</h3>
            <div className="gocrumbs-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="gc-rent">{t('gocrumbs.rent')}</label>
                <MoneyInput id="gc-rent" value={form.rent} onChange={v => set('rent', v)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gc-savings">{t('gocrumbs.savings')}</label>
                <MoneyInput id="gc-savings" value={form.savings} onChange={v => set('savings', v)} />
              </div>
            </div>

            <div className="form-label" style={{ marginTop: '4px' }}>{t('gocrumbs.subscriptions')}</div>
            {renderLines('subs', form.subs, t('gocrumbs.addSubscription'))}

            <div className="form-label" style={{ marginTop: '20px' }}>{t('gocrumbs.custom')}</div>
            {renderLines('custom', form.custom, t('gocrumbs.addExpense'))}

            {lineCount >= MAX_EXPENSE_LINES && (
              <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)' }}>{t('gocrumbs.maxLines', { count: MAX_EXPENSE_LINES })}</small>
            )}
            {nameMissing && <div className="alert alert-error" style={{ marginTop: '12px' }}>{t('gocrumbs.nameRequired')}</div>}
          </div>

          {/* Second Save at the end of the form, so saving doesn't need a scroll back to the top */}
          <div className="gocrumbs-actions gocrumbs-save-bottom">
            {saveStatus}
            {saveButton}
          </div>
        </div>

        {/* Result */}
        <div className="gocrumbs-result" ref={resultRef}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>{t('gocrumbs.resultTitle')}</h3>
              {calculating && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('gocrumbs.calculating')}</span>}
            </div>

            {calcError && <div className="alert alert-error">{calcError}</div>}

            {!result ? (
              <div className="empty-state" style={{ padding: '24px 8px' }}>
                <div className="empty-state-icon">🧮</div>
                <p>{t(form.workType === 'werkstudent' ? 'gocrumbs.emptyHintWs' : 'gocrumbs.emptyHint')}</p>
              </div>
            ) : (
              <div style={{ opacity: calculating ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <ResultRow label={t('gocrumbs.result.gross')} value={eur.format(result.gross)} bold />
                {result.extra_taxable > 0 && <ResultRow indent label={t('gocrumbs.result.extraTaxable')} value={eur.format(result.extra_taxable)} />}
                {result.extra_free > 0 && <ResultRow indent label={t('gocrumbs.result.extraFree')} value={eur.format(result.extra_free)} />}
                {([
                  ['rv', result.rv], ['av', result.av], ['kv', result.kv], ['pv', result.pv],
                  ['lohnsteuer', result.lohnsteuer], ['soli', result.soli], ['kirchensteuer', result.kirchensteuer],
                ] as const)
                  .filter(([, v]) => v > 0)
                  .map(([key, v]) => (
                    <ResultRow key={key} indent label={t(`gocrumbs.result.${key}`)} value={`− ${eur.format(v)}`} />
                  ))}
                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                <ResultRow label={t('gocrumbs.result.net')} value={eur.format(result.net)} bold />
                {result.expenses.total > 0 && (
                  <>
                    <button
                      type="button"
                      className="gocrumbs-expenses-toggle"
                      aria-expanded={showExpenses}
                      onClick={() => setShowExpenses(v => !v)}
                    >
                      <span>
                        <span className="gocrumbs-chevron" aria-hidden="true">{showExpenses ? '▾' : '▸'}</span>
                        {t('gocrumbs.result.expenses')}
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>− {eur.format(result.expenses.total)}</span>
                    </button>
                    {showExpenses && resultInput && <ExpenseBreakdown input={resultInput} />}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '8px 0', color: leftColor }}>
                  <span style={{ fontWeight: 700 }}>{overspent ? t('gocrumbs.result.overspent') : t('gocrumbs.result.left')}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{eur.format(Math.abs(result.left))}</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{t('gocrumbs.result.taxRate')}: {percent.format(result.tax_rate)}</span>
                  {result.expenses.savings > 0 && <span>{t('gocrumbs.result.savingsRate')}: {percent.format(result.savings_rate)}</span>}
                </div>

                {chartData.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div className="form-label">{t('gocrumbs.chart.title')}</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {chartData.map(s => (
                            <Cell key={s.key} fill={s.color} stroke="var(--card-bg)" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => eur.format(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '0.8rem' }}>
                      {chartData.map(s => (
                        <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* The API sent null instead of [] when no note applied (fixed in GopherDebt #44); tolerate both */}
                {(result.notes ?? []).length > 0 && (
                  <ul style={{ margin: '16px 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {(result.notes ?? []).map(code => (
                      <li key={code} style={{ marginBottom: '4px' }}>{t(`gocrumbs.notes.${code}` as never, { defaultValue: code })}</li>
                    ))}
                  </ul>
                )}

                <p style={{ margin: '16px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('gocrumbs.disclaimer', { year: result.tax_year })}
                </p>
                <details style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <summary style={{ cursor: 'pointer' }}>{t('gocrumbs.notIncludedTitle')}</summary>
                  <p style={{ margin: '6px 0 0' }}>{t('gocrumbs.notIncluded')}</p>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {dialog === 'new' && (
        <PageDialog
          title={t('gocrumbs.pages.newTitle')}
          submitLabel={t('gocrumbs.pages.create')}
          initialName=""
          copyChoice={{
            defaultCopy: pageId !== null || incomeEntered,
            hint: dirty && pageId !== null ? t('gocrumbs.pages.copyUnsaved', { name: pageName }) : null,
          }}
          onSubmit={handleNewPage}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'saveDraft' && (
        <PageDialog
          title={t('gocrumbs.pages.saveTitle')}
          submitLabel={t('gocrumbs.save')}
          initialName=""
          onSubmit={name => createPage(name, input, true)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'rename' && (
        <PageDialog
          title={t('gocrumbs.pages.renameTitle')}
          submitLabel={t('gocrumbs.save')}
          initialName={pageName}
          onSubmit={handleRename}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Phone: keep the answer in view while editing */}
      {result && !loading && (
        <button type="button" className="gocrumbs-bar" onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span>{overspent ? t('gocrumbs.result.overspent') : t('gocrumbs.result.left')}</span>
          <span style={{ color: leftColor, fontWeight: 800 }}>{eur.format(Math.abs(result.left))}</span>
        </button>
      )}
    </div>
  );
}
