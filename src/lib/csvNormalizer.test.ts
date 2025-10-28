import { describe, expect, it } from 'vitest';
import { normalizeHeader } from './csv/headerAliases';
import { mergeDateAndTime, normalizeNumber, sanitizeAndNormalizeDate } from './csv/datetime';
import { normalizeCSV } from './csv/normalizeCSV';

const sampleCsv = `symbol;qty;buy/sell;entry date;entry time;exit date;exit time;avg price\nES;2;B;01/02/2024;14:30;01/02/2024;15:00;4300,5`;

describe('header normalization', () => {
  it('maps alias headers to canonical names', () => {
    expect(normalizeHeader('ticker')).toBe('ContractName');
    expect(normalizeHeader('Qty')).toBe('Size');
    expect(normalizeHeader('buy/sell')).toBe('Side');
    expect(normalizeHeader('Entry Time')).toBe('CreatedAt');
  });
});

describe('date normalization', () => {
  it('merges separate date and time columns', () => {
    const merged = mergeDateAndTime('01/02/2024', '14:30');
    expect(merged).toMatch(/^2024-02-01 14:30:00/);
  });

  it('handles european decimal comma numbers', () => {
    expect(normalizeNumber('1,25')).toBeCloseTo(1.25);
  });

  it('normalizes fallback dates', () => {
    const fallback = new Date('2024-01-01T10:00:00Z');
    const normalized = sanitizeAndNormalizeDate('', fallback);
    expect(normalized).toBe('2024-01-01 11:00:00');
  });
});

describe('normalizeCSV', () => {
  it('normalizes rows and provides warnings', () => {
    const result = normalizeCSV(sampleCsv);
    expect(result.rows).toHaveLength(1);
    const [first] = result.rows;
    expect(first.row.ContractName).toBe('ES');
    expect(first.row.Size).toBe(2);
    expect(first.row.Side).toBe('Buy');
    expect(first.row.ExecutePrice).toBeCloseTo(4300.5);
    expect(first.row.CreatedAt).toMatch(/^2024-02-01/);
  });

  it('flags invalid size', () => {
    const csv = `symbol,qty,avg price\nES,-1,4200`;
    const result = normalizeCSV(csv);
    expect(result.rows[0].warnings).toContain('Size must be greater than zero.');
  });
});

