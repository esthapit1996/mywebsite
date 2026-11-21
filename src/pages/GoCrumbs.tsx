import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  MAX_CHILDREN,
  MAX_EXPENSE_AMOUNT,
  MAX_EXPENSE_LINES,
  MAX_EXTRA_PAY_LINES,
  MAX_GROSS_MONTH,
  MAX_GROSS_YEAR,
  MAX_SIDE_GROSS,
  MAX_WS_HOURS_MONTH,
  MAX_WS_HOURS_WEEK,
  MAX_WS_WAGE,
  WEEKS_PER_MONTH,
  WS_WEEKLY_HOURS_LIMIT,
  MAX_ZUSATZBEITRAG,
  STEUERKLASSEN,
} from '../constants/gocrumbs';
import type { GoCrumbsExpenseLine, GoCrumbsExtraPayLine, GoCrumbsInput, GoCrumbsProfile, GoCrumbsResult } from '../types';

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
  workType: 'fte' | 'werkstudent';
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

function profileToForm(p: GoCrumbsProfile): FormState {
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

export default function GoCrumbs() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null); // last saved input as JSON; null = never saved
  const [result, setResult] = useState<GoCrumbsResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const requestSeq = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const input = useMemo(() => formToInput(form), [form]);
  const inputKey = useMemo(() => JSON.stringify(input), [input]);
  // Extra pay only exists for employees, so a hidden line of it must not block anything
  const nameMissing = hasUnnamedAmount(form.subs) || hasUnnamedAmount(form.custom) || (form.workType === 'fte' && hasUnnamedAmount(form.extra));
  const lineCount = form.subs.length + form.custom.length;
  const children = childrenOf(form);
  const weeklyHours = input.ws_hours_period === 'week' ? input.ws_hours : input.ws_hours / WEEKS_PER_MONTH;
  const incomeEntered = hasIncome(input);
  const dirty = savedKey === null ? incomeEntered : savedKey !== inputKey;
  const canSave = dirty && incomeEntered && !nameMissing && !saving;

  // Load the saved profile (first-time users start with defaults)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGoCrumbs();
        if (cancelled) return;
        if (res.data) {
          const loaded = profileToForm(res.data);
          setForm(loaded);
          setSavedKey(JSON.stringify(formToInput(loaded)));
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, t('gocrumbs.loadFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

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

  const handleSave = async () => {
    const body = input;
    const key = inputKey;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.saveGoCrumbs(body);
      setSavedKey(key);
      setSaveMsg({ ok: true, text: t('gocrumbs.saved') });
    } catch (err) {
      setSaveMsg({ ok: false, text: errorMessage(err, t('gocrumbs.saveFailed')) });
    } finally {
      setSaving(false);
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

  if (loading) return <LoadingSpinner message={t('gocrumbs.loading')} />;

  const overspent = result !== null && result.left < 0;
  const leftColor = overspent ? 'var(--danger)' : 'var(--primary)';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {dirty && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('gocrumbs.unsaved')}</span>}
            <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
              {saving ? t('gocrumbs.saving') : t('gocrumbs.save')}
            </button>
          </div>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('gocrumbs.tagline')}</p>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}
      {saveMsg && <div className={`alert ${saveMsg.ok ? 'alert-success' : 'alert-error'}`}>{saveMsg.text}</div>}

      <div className="gocrumbs-layout">
        <div>
          {/* Work situation */}
          <div className="card">
            <h3>{t('gocrumbs.workTitle')}</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['fte', 'werkstudent'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm ${form.workType === type ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={form.workType === type}
                  onClick={() => set('workType', type)}
                >
                  {t(`gocrumbs.workType.${type}`)}
                </button>
              ))}
            </div>
            {form.workType === 'werkstudent' && (
              <p style={{ margin: '12px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('gocrumbs.werkstudentInfo')}</p>
            )}
          </div>

          {/* Income */}
          <div className="card">
            <h3>{t('gocrumbs.incomeTitle')}</h3>
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
                  <select id="gc-ws-period" className="form-select" aria-label={t('gocrumbs.wsHoursPeriod')} value={form.wsPeriod} onChange={e => set('wsPeriod', e.target.value as 'week' | 'month')}>
                    <option value="month">{t('gocrumbs.wsPerMonth')}</option>
                    <option value="week">{t('gocrumbs.wsPerWeek')}</option>
                  </select>
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
                    <select id="gc-period" className="form-select" aria-label={t('gocrumbs.grossPeriod')} value={form.period} onChange={e => set('period', e.target.value as 'month' | 'year')}>
                      <option value="month">{t('gocrumbs.perMonth')}</option>
                      <option value="year">{t('gocrumbs.perYear')}</option>
                    </select>
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
                <select id="gc-class" className="form-select" value={form.steuerklasse} onChange={e => set('steuerklasse', Number(e.target.value))}>
                  {STEUERKLASSEN.map(c => (
                    <option key={c} value={c}>{t(`gocrumbs.classes.${c}` as never)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gc-state">{t('gocrumbs.bundesland')}</label>
                <select id="gc-state" className="form-select" value={form.bundesland} onChange={e => set('bundesland', e.target.value)}>
                  {BUNDESLAENDER.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
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
              <div className="form-group">
                <label className="form-label" htmlFor="gc-zusatz">{t('gocrumbs.zusatzbeitrag')}</label>
                <MoneyInput id="gc-zusatz" value={form.zusatz} onChange={v => set('zusatz', v)} />
              </div>
            </div>
            <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '12px' }}>{t('gocrumbs.zusatzHint')}</small>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: children === 0 ? '10px' : 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.churchTax} onChange={e => set('churchTax', e.target.checked)} />
              {t('gocrumbs.churchTax')}
            </label>
            {children === 0 && (
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
                    <ResultRow indent label={t('gocrumbs.result.expenses')} value={`− ${eur.format(result.expenses.total)}`} />
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

                {result.notes.length > 0 && (
                  <ul style={{ margin: '16px 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {result.notes.map(code => (
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

      {/* Phone: keep the answer in view while editing */}
      {result && (
        <button type="button" className="gocrumbs-bar" onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span>{overspent ? t('gocrumbs.result.overspent') : t('gocrumbs.result.left')}</span>
          <span style={{ color: leftColor, fontWeight: 800 }}>{eur.format(Math.abs(result.left))}</span>
        </button>
      )}
    </div>
  );
}
