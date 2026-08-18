const flattenValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenValues);
  return value === undefined || value === null ? [] : [String(value)];
};

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const compactSearch = (value) => normalizeSearch(value).replace(/[^a-z0-9]/g, '');

const phoneAliases = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^2519\d{8}$/.test(digits)) return [digits, `0${digits.slice(3)}`];
  if (/^09\d{8}$/.test(digits)) return [digits, `251${digits.slice(1)}`];
  return digits ? [digits] : [];
};

export function matchesSearch(values, query) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const fields = flattenValues(values);
  const haystack = fields.flatMap((field) => [normalizeSearch(field), compactSearch(field), ...phoneAliases(field)]).join(' ');
  return normalizedQuery.split(' ').every((term) => {
    const candidates = [term, compactSearch(term), ...phoneAliases(term)].filter(Boolean);
    return candidates.some((candidate) => haystack.includes(candidate));
  });
}

export function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

export function stableSort(items, compare, tieBreaker = (item) => item?.id || item?.name || '') {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compare(left.item, right.item) || compareText(tieBreaker(left.item), tieBreaker(right.item)) || left.index - right.index)
    .map(({ item }) => item);
}

export const periodOptions = [['all', 'All time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month']];

export function periodBounds(period, from, to) {
  const now = new Date();
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === 'today') { const start = startOfDay(now); return [start, new Date(start.getTime() + 86400000)]; }
  if (period === 'yesterday') { const end = startOfDay(now); return [new Date(end.getTime() - 86400000), end]; }
  if (period === 'week') { const start = startOfDay(new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000)); return [start, new Date(start.getTime() + 7 * 86400000)]; }
  if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  if (period === 'custom' && (from || to)) return [from ? new Date(`${from}T00:00:00`) : new Date(0), to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400000) : new Date(8640000000000000)];
  return null;
}

export function withinPeriod(dateValue, bounds) {
  return !bounds || (new Date(dateValue) >= bounds[0] && new Date(dateValue) < bounds[1]);
}
