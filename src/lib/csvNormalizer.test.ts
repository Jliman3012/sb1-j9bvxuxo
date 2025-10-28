import { describe, expect, it } from 'vitest';
import { normalizeCSV, parseCSV } from './csvNormalizer';

const normalizeRows = (rows: string[][]) => rows.map(row => row.join('|'));

describe('parseCSV', () => {
  it('detects semicolon separated values', () => {
    const csv = 'id;symbol;quantity\n1;ES;2\n2;NQ;3';
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(3);
    expect(normalizeRows(rows)).toEqual([
      'id|symbol|quantity',
      '1|ES|2',
      '2|NQ|3',
    ]);
  });

  it('detects tab separated values', () => {
    const csv = 'id\tsymbol\tquantity\n1\tES\t2';
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(2);
    expect(normalizeRows(rows)).toEqual([
      'id|symbol|quantity',
      '1|ES|2',
    ]);
  });

  it('strips BOM characters before parsing', () => {
    const csv = '\uFEFFid,symbol,quantity\n1,ES,2';
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(2);
    expect(normalizeRows(rows)).toEqual([
      'id|symbol|quantity',
      '1|ES|2',
    ]);
  });
});

describe('normalizeCSV', () => {
  it('normalizes data parsed from dynamically detected delimiters', () => {
    const csv = 'id\tsymbol\tquantity\tbuy/sell\tentry time\tfill price\n1\tES\t2\tBuy\t2024-01-01T10:00:00Z\t4300';
    const { normalized, stats } = normalizeCSV(csv);

    const normalizedLines = normalized.split('\n');

    expect(stats.rowsProcessed).toBe(1);
    expect(stats.broker).toBe('unknown');
    expect(normalizedLines[1]).toContain('1');
    expect(normalizedLines[1]).toContain('ES');
    expect(normalizedLines[1]).toContain('Buy');
    expect(normalizedLines[1]).toContain('4300');
  });
});
