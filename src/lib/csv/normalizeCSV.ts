import Papa from 'papaparse';
import { z } from 'zod';
import { normalizeHeader, type ManualHeaderMap, type TargetHeader } from './headerAliases';
import { mergeDateAndTime, normalizeNumber, sanitizeAndNormalizeDate } from './datetime';

export interface NormalizationOptions {
  manualHeaderMap?: ManualHeaderMap;
  fallbackDate?: Date;
  limit?: number;
}

export interface NormalizedTrade {
  Id: string;
  AccountName: string;
  ContractName: string;
  Status: string;
  Type: string;
  Size: number | null;
  Side: string;
  CreatedAt: string | null;
  TradeDay: string | null;
  FilledAt: string | null;
  CancelledAt: string | null;
  StopPrice: number | null;
  LimitPrice: number | null;
  ExecutePrice: number | null;
  PositionDisposition: string | null;
  CreationDisposition: string | null;
  RejectionReason: string | null;
  ExchangeOrderId: string | null;
  PlatformOrderId: string | null;
}

export interface NormalizedRowResult {
  row: NormalizedTrade;
  warnings: string[];
}

export interface NormalizeCSVResult {
  rows: NormalizedRowResult[];
  detectedDelimiter: string;
  headerMapping: Record<string, TargetHeader | null>;
  totalRows: number;
}

const NormalizedTradeSchema = z.object({
  Id: z.string().min(1),
  AccountName: z.string().optional().transform(value => value ?? ''),
  ContractName: z.string().optional().transform(value => value ?? ''),
  Status: z.string().min(1),
  Type: z.string().min(1),
  Size: z.number().nullable(),
  Side: z.string().min(1),
  CreatedAt: z.string().nullable(),
  TradeDay: z.string().nullable(),
  FilledAt: z.string().nullable(),
  CancelledAt: z.string().nullable(),
  StopPrice: z.number().nullable(),
  LimitPrice: z.number().nullable(),
  ExecutePrice: z.number().nullable(),
  PositionDisposition: z.string().nullable(),
  CreationDisposition: z.string().nullable(),
  RejectionReason: z.string().nullable(),
  ExchangeOrderId: z.string().nullable(),
  PlatformOrderId: z.string().nullable(),
});

const normalizeSide = (value: string | null | undefined): string => {
  if (!value) {
    return 'Buy';
  }

  const normalized = value.toLowerCase().trim();

  if (['buy', 'b', 'long', 'l'].includes(normalized)) {
    return 'Buy';
  }

  if (['sell', 's', 'short'].includes(normalized)) {
    return 'Sell';
  }

  return value.trim();
};

const normalizeType = (value: string | null | undefined): string => {
  if (!value) {
    return 'Market';
  }

  const normalized = value.toLowerCase().trim();

  if (['market', 'm', 'mkt'].includes(normalized)) {
    return 'Market';
  }

  if (['limit', 'l', 'lmt'].includes(normalized)) {
    return 'Limit';
  }

  if (['stop', 'stp'].includes(normalized)) {
    return 'Stop';
  }

  return value.trim();
};

const detectDelimiter = (content: string): string => {
  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let bestScore = -Infinity;

  for (const delimiter of delimiters) {
    const lines = content.split(/\r?\n/).slice(0, 5);
    const counts = lines.map(line => line.split(delimiter).length);
    const average = counts.reduce((sum, count) => sum + count, 0) / Math.max(counts.length, 1);
    if (average > bestScore) {
      bestScore = average;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
};

const sanitizeHeader = (header: string): string => header.replace(/\uFEFF/g, '').trim();

interface DateColumnGroup {
  dateIndex?: number;
  timeIndex?: number;
}

const createDateGroups = (headers: string[]): Record<'created' | 'filled' | 'trade', DateColumnGroup> => {
  const groups: Record<'created' | 'filled' | 'trade', DateColumnGroup> = {
    created: {},
    filled: {},
    trade: {},
  };

  headers.forEach((header, index) => {
    const lower = header.toLowerCase();

    if (/entry/.test(lower) && /date/.test(lower)) {
      groups.created.dateIndex = index;
    }

    if (/entry/.test(lower) && /time/.test(lower)) {
      groups.created.timeIndex = index;
    }

    if ((/exit/.test(lower) || /fill/.test(lower) || /close/.test(lower)) && /date/.test(lower)) {
      groups.filled.dateIndex = index;
    }

    if ((/exit/.test(lower) || /fill/.test(lower) || /close/.test(lower)) && /time/.test(lower)) {
      groups.filled.timeIndex = index;
    }

    if (/trade/.test(lower) && /date|day/.test(lower)) {
      groups.trade.dateIndex = index;
    }
  });

  return groups;
};

export const normalizeCSV = (
  csvContent: string,
  { manualHeaderMap, fallbackDate, limit }: NormalizationOptions = {},
): NormalizeCSVResult => {
  const delimiter = detectDelimiter(csvContent);

  const parseResult = Papa.parse<string[]>(csvContent, {
    delimiter: '',
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: undefined,
  });

  const rows = parseResult.data.filter((row): row is string[] => Array.isArray(row));

  if (rows.length === 0) {
    return {
      rows: [],
      detectedDelimiter: delimiter,
      headerMapping: {},
      totalRows: 0,
    };
  }

  const rawHeaders = rows[0].map(sanitizeHeader);

  const headerMapping: Record<string, TargetHeader | null> = {};
  const targetColumnIndices: Partial<Record<TargetHeader, number[]>> = {};
  const dateGroups = createDateGroups(rawHeaders);

  rawHeaders.forEach((header, index) => {
    const manual = manualHeaderMap?.[header];
    const normalized = manual ?? normalizeHeader(header);
    headerMapping[header] = normalized;

    if (normalized) {
      if (!targetColumnIndices[normalized]) {
        targetColumnIndices[normalized] = [];
      }
      targetColumnIndices[normalized]!.push(index);
    }
  });

  const normalizedRows: NormalizedRowResult[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => (cell ?? '').toString().trim() === '')) {
      continue;
    }

    const getColumnValue = (target: TargetHeader): string | null => {
      const indices = targetColumnIndices[target];
      if (!indices || indices.length === 0) {
        return null;
      }

      const values = indices
        .map(index => row[index])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      return values.length > 0 ? values[0] : null;
    };

    const createdAt = (() => {
      const fromGroup = mergeDateAndTime(
        dateGroups.created.dateIndex !== undefined ? row[dateGroups.created.dateIndex] : getColumnValue('CreatedAt'),
        dateGroups.created.timeIndex !== undefined ? row[dateGroups.created.timeIndex] : undefined,
      );

      if (fromGroup) {
        return fromGroup;
      }

      const value = getColumnValue('CreatedAt');
      return sanitizeAndNormalizeDate(value ?? '', fallbackDate ?? undefined);
    })();

    const filledAt = (() => {
      const fromGroup = mergeDateAndTime(
        dateGroups.filled.dateIndex !== undefined ? row[dateGroups.filled.dateIndex] : getColumnValue('FilledAt'),
        dateGroups.filled.timeIndex !== undefined ? row[dateGroups.filled.timeIndex] : undefined,
      );

      if (fromGroup) {
        return fromGroup;
      }

      const value = getColumnValue('FilledAt');
      return sanitizeAndNormalizeDate(value ?? '', createdAt ? new Date(createdAt) : fallbackDate);
    })();

    const tradeDay = (() => {
      const fromGroup =
        dateGroups.trade.dateIndex !== undefined
          ? sanitizeAndNormalizeDate(row[dateGroups.trade.dateIndex] ?? '', createdAt ? new Date(createdAt) : undefined)
          : null;

      if (fromGroup) {
        return fromGroup;
      }

      const value = getColumnValue('TradeDay');
      const normalized = sanitizeAndNormalizeDate(value ?? '', createdAt ? new Date(createdAt) : fallbackDate);
      if (normalized) {
        return normalized.split(' ')[0] ? `${normalized.split(' ')[0]} 00:00:00` : normalized;
      }

      if (createdAt) {
        return `${createdAt.split(' ')[0]} 00:00:00`;
      }

      if (filledAt) {
        return `${filledAt.split(' ')[0]} 00:00:00`;
      }

      if (fallbackDate) {
        return sanitizeAndNormalizeDate('', fallbackDate);
      }

      return null;
    })();

    const baseRow: NormalizedTrade = {
      Id: getColumnValue('Id') ?? '',
      AccountName: getColumnValue('AccountName') ?? '',
      ContractName: getColumnValue('ContractName') ?? '',
      Status: getColumnValue('Status') ?? 'Filled',
      Type: normalizeType(getColumnValue('Type')),
      Size: normalizeNumber(getColumnValue('Size')),
      Side: normalizeSide(getColumnValue('Side')),
      CreatedAt: createdAt,
      TradeDay: tradeDay,
      FilledAt: filledAt,
      CancelledAt: sanitizeAndNormalizeDate(getColumnValue('CancelledAt') ?? ''),
      StopPrice: normalizeNumber(getColumnValue('StopPrice')),
      LimitPrice: normalizeNumber(getColumnValue('LimitPrice')),
      ExecutePrice: normalizeNumber(getColumnValue('ExecutePrice')),
      PositionDisposition: getColumnValue('PositionDisposition'),
      CreationDisposition: getColumnValue('CreationDisposition'),
      RejectionReason: getColumnValue('RejectionReason'),
      ExchangeOrderId: getColumnValue('ExchangeOrderId'),
      PlatformOrderId: getColumnValue('PlatformOrderId'),
    };

    if (!baseRow.Id) {
      baseRow.Id = baseRow.ExchangeOrderId ?? baseRow.PlatformOrderId ?? `${baseRow.AccountName || 'trade'}-${i}`;
    }

    if (!baseRow.TradeDay && baseRow.CreatedAt) {
      baseRow.TradeDay = `${baseRow.CreatedAt.split(' ')[0]} 00:00:00`;
    }

    if (!baseRow.CreatedAt && baseRow.FilledAt) {
      baseRow.CreatedAt = baseRow.FilledAt;
    }

    if (!baseRow.Status) {
      baseRow.Status = 'Filled';
    }

    if (!baseRow.Type) {
      baseRow.Type = 'Market';
    }

    const warnings: string[] = [];

    if (baseRow.Size !== null && baseRow.Size <= 0) {
      warnings.push('Size must be greater than zero.');
    }

    if (baseRow.ExecutePrice !== null && baseRow.ExecutePrice <= 0) {
      warnings.push('Execute price must be greater than zero.');
    }

    if (!baseRow.ExchangeOrderId && !baseRow.PlatformOrderId && !baseRow.Id) {
      warnings.push('Missing identifier (ExchangeOrderId, PlatformOrderId, or Id).');
    }

    if (!baseRow.CreatedAt) {
      warnings.push('Missing CreatedAt timestamp.');
    }

    if (!baseRow.TradeDay) {
      warnings.push('Missing TradeDay.');
    }

    const parsedRow = NormalizedTradeSchema.safeParse(baseRow);
    if (!parsedRow.success) {
      warnings.push(...parsedRow.error.errors.map(error => error.message));
    }

    normalizedRows.push({ row: parsedRow.success ? parsedRow.data : baseRow, warnings });

    if (limit && normalizedRows.length >= limit) {
      break;
    }
  }

  return {
    rows: normalizedRows,
    detectedDelimiter: delimiter,
    headerMapping,
    totalRows: rows.length - 1,
  };
};

export type NormalizedCSVResult = ReturnType<typeof normalizeCSV>;

