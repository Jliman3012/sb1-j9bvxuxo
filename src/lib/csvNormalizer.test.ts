import { describe, it, expect } from 'vitest';
import { normalizeCSV, parseCSV } from './csvNormalizer';

describe('normalizeCSV identifier handling', () => {
  it('generates deterministic IDs when all identifiers are missing', () => {
    const csv = [
      'ContractName,ExecutePrice,Size,Side,CreatedAt',
      'ESU4,4500.5,2,Buy,2024-08-01T13:30:00Z'
    ].join('\n');

    const first = normalizeCSV(csv);
    const second = normalizeCSV(csv);

    expect(first.stats.rowsMissingIdentifiers).toBe(1);
    expect(first.stats.deterministicIdsAssigned).toBe(1);
    expect(first.stats.missingIdentifierRows).toEqual([2]);

    const firstParsed = parseCSV(first.normalized);
    const secondParsed = parseCSV(second.normalized);

    expect(firstParsed[1][0]).toMatch(/^ORDER_[0-9a-f]{16}$/);
    expect(firstParsed[1][0]).toBe(secondParsed[1][0]);
  });

  it('reuses provided identifiers when available', () => {
    const csv = [
      'ExchangeOrderId,ContractName,ExecutePrice,Size,Side',
      'ABC123,ESU4,4501.25,1,Sell'
    ].join('\n');

    const result = normalizeCSV(csv);
    const parsed = parseCSV(result.normalized);

    expect(result.stats.rowsMissingIdentifiers).toBe(0);
    expect(result.stats.deterministicIdsAssigned).toBe(0);
    expect(result.stats.missingIdentifierRows).toEqual([]);
    expect(parsed[1][0]).toBe('ABC123');
  });

  it('produces stable identifiers even if column order changes', () => {
    const csvOriginal = [
      'ContractName,ExecutePrice,Size,Side,CreatedAt',
      'ESU4,4500.5,2,Buy,2024-08-01 13:30:00'
    ].join('\n');

    const csvReordered = [
      'Side,Size,CreatedAt,ExecutePrice,ContractName',
      'Buy,2,2024-08-01 13:30:00,4500.5,ESU4'
    ].join('\n');

    const first = normalizeCSV(csvOriginal);
    const second = normalizeCSV(csvReordered);

    const firstParsed = parseCSV(first.normalized);
    const secondParsed = parseCSV(second.normalized);

    expect(firstParsed[1][0]).toBe(secondParsed[1][0]);
    expect(first.stats.deterministicIdsAssigned).toBe(1);
    expect(second.stats.deterministicIdsAssigned).toBe(1);
  });
});
