import { describe, expect, it } from 'vitest';
import { isTopstepHeader, mapTopstepRow } from '../adapters/topstep';

const headers = [
  'Id',
  'ContractName',
  'EnteredAt',
  'ExitedAt',
  'EntryPrice',
  'ExitPrice',
  'Fees',
  'PnL',
  'Size',
  'Type',
  'TradeDay',
  'TradeDuration',
  'Commissions',
];

describe('Topstep adapter', () => {
  it('detects valid Topstep headers', () => {
    expect(isTopstepHeader(headers)).toBe(true);
  });

  it('maps rows to target trade format', () => {
    const row = {
      Id: '1531742605',
      ContractName: 'NQZ5',
      EnteredAt: '10/28/2025 00:36:30 +01:00',
      ExitedAt: '10/28/2025 01:03:55 +01:00',
      EntryPrice: '26012.25',
      ExitPrice: '25987.00',
      Fees: '8.40',
      PnL: '1515.00',
      Size: '3',
      Type: 'Short',
      TradeDay: '10/28/2025 00:00:00 -05:00',
      TradeDuration: '00:27:25.4860780',
      Commissions: '',
    } as const;

    const mapped = mapTopstepRow(row);

    expect(mapped).toEqual({
      Id: '1531742605',
      AccountName: 'Topstep',
      ContractName: 'NQZ5',
      Status: 'Filled',
      Type: 'Market',
      Size: '3',
      Side: 'Sell',
      CreatedAt: '2025-10-28 00:36:30',
      TradeDay: '2025-10-28',
      FilledAt: '2025-10-28 01:03:55',
      CancelledAt: '',
      StopPrice: '',
      LimitPrice: '',
      ExecutePrice: '26012.25',
      PositionDisposition: 'Closed',
      CreationDisposition: 'Imported',
      RejectionReason: '',
      ExchangeOrderId: '',
      PlatformOrderId: '1531742605',
    });
  });
});
