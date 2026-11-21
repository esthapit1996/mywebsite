// GoCrumbs settings in one place. The display name lives in i18n (`gocrumbs.name`,
// `header.goCrumbs`), so renaming the feature means changing those keys and GOCRUMBS_ROUTE.

export const GOCRUMBS_ROUTE = '/gocrumbs';

export const CALC_DEBOUNCE_MS = 400;
export const MAX_EXPENSE_LINES = 50; // subscriptions + custom lines, same limit as the API
export const MAX_EXTRA_PAY_LINES = 20; // same limit as the API
export const MAX_CHILDREN = 20;
export const MAX_ZUSATZBEITRAG = 10;
export const DEFAULT_ZUSATZBEITRAG = '2.9'; // 2026 average Zusatzbeitrag in %
export const DEFAULT_BUNDESLAND = 'NW';

// Limits mirror the API: gross per month up to 1,000,000 or per year up to 10,000,000
export const MAX_GROSS_MONTH = 1_000_000;
export const MAX_GROSS_YEAR = 10_000_000;
export const MAX_SIDE_GROSS = 100_000;
export const MAX_EXPENSE_AMOUNT = 1_000_000;

// Werkstudent income is hourly wage x hours; limits mirror the API
export const MAX_WS_WAGE = 1_000;
export const MAX_WS_HOURS_MONTH = 744;
export const MAX_WS_HOURS_WEEK = 168;
export const WEEKS_PER_MONTH = 52 / 12; // weekly hours count as an average month
export const WS_WEEKLY_HOURS_LIMIT = 20; // Werkstudent rules: at most 20 hours a week during lectures

export const STEUERKLASSEN = [1, 2, 3, 4, 5, 6] as const;

// Federal states: the code is what the API stores (it sets the church tax rate and the Sachsen care-insurance rule)
export const BUNDESLAENDER: { code: string; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];
