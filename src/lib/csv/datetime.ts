import { parse, isValid, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const BUDAPEST_TZ = 'Europe/Budapest';

const DATE_FORMATS = [
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mm:ss",
  'yyyy-MM-dd',
  'dd/MM/yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm',
  'dd/MM/yyyy',
  'MM/dd/yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm',
  'MM/dd/yyyy',
  'MM-dd-yyyy HH:mm:ss',
  'MM-dd-yyyy HH:mm',
  'MM-dd-yyyy',
  'dd-MM-yyyy HH:mm:ss',
  'dd-MM-yyyy HH:mm',
  'dd-MM-yyyy',
  'dd.MM.yyyy HH:mm:ss',
  'dd.MM.yyyy HH:mm',
  'dd.MM.yyyy',
];

const TIME_FORMATS = ['HH:mm:ss', 'HH:mm', 'H:mm', 'HHmmss', 'HHmm'];

const hasTimezoneToken = (value: string) => /([+-]\d{2}:?\d{2}|Z)$/i.test(value.trim());

const cleanDateInput = (value: string) =>
  value
    .replace(/\uFEFF/g, '')
    .replace(/\./g, '/')
    .replace(/-/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

const toBudapestIsoString = (date: Date) => {
  const zoned = toZonedTime(date, BUDAPEST_TZ);
  return format(zoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: BUDAPEST_TZ });
};

const parseWithFormats = (value: string, formats: string[]): Date | null => {
  for (const fmt of formats) {
    const parsed = parse(value, fmt, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const mergeDateAndTime = (dateValue?: string | null, timeValue?: string | null): string | null => {
  if (!dateValue && !timeValue) {
    return null;
  }

  if (dateValue && timeValue) {
    const trimmedTime = timeValue.trim();
    const sanitized = `${dateValue.trim()} ${trimmedTime}`;
    return sanitizeAndNormalizeDate(sanitized);
  }

  return sanitizeAndNormalizeDate(dateValue ?? timeValue ?? '');
};

export const sanitizeAndNormalizeDate = (value: string, fallback?: Date): string | null => {
  if (!value || value.trim().length === 0) {
    if (fallback) {
      return toBudapestIsoString(fallback);
    }
    return null;
  }

  const raw = value.trim();

  const hasTZ = hasTimezoneToken(raw) || /GMT|UTC|CE(S)?T/i.test(raw);

  const cleaned = cleanDateInput(raw);

  if (hasTZ) {
    const parsed = new Date(raw);
    if (isValid(parsed)) {
      return toBudapestIsoString(parsed);
    }
  }

  const withTime = parseWithFormats(cleaned, DATE_FORMATS);
  if (withTime) {
    const utcDate = fromZonedTime(withTime, BUDAPEST_TZ);
    return toBudapestIsoString(utcDate);
  }

  const dateOnly = parseWithFormats(cleaned, ['yyyy/MM/dd', 'MM/dd/yyyy', 'dd/MM/yyyy']);
  if (dateOnly) {
    const base = fromZonedTime(dateOnly, BUDAPEST_TZ);
    return toBudapestIsoString(base);
  }

  const timeOnly = parseWithFormats(cleaned, TIME_FORMATS);
  if (timeOnly && fallback) {
    const fallbackIso = toBudapestIsoString(fallback);
    const datePart = fallbackIso.split(' ')[0];
    const timePart = format(timeOnly, 'HH:mm:ss');
    const composed = `${datePart} ${timePart}`;
    return sanitizeAndNormalizeDate(composed);
  }

  const constructed = new Date(raw);
  if (isValid(constructed)) {
    return toBudapestIsoString(constructed);
  }

  if (fallback) {
    return toBudapestIsoString(fallback);
  }

  return null;
};

export const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  const sanitized = str.replace(/\s+/g, '').replace(',', '.');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
};

