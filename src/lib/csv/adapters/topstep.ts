import { toISODateTime, toISODate } from '../datetime';
import type { TargetTrade } from '@/types/trade';

export type TopstepRow = {
  Id: string | number;
  ContractName: string;
  EnteredAt?: string;
  ExitedAt?: string;
  EntryPrice?: string | number;
  ExitPrice?: string | number;
  Fees?: string | number;
  PnL?: string | number;
  Size?: string | number;
  Type?: string;
  TradeDay?: string;
  TradeDuration?: string;
  Commissions?: string | number;
} & Record<string, unknown>;

const dirToSide = (value?: string) => {
  const normalized = (value ?? '').toLowerCase().trim();
  if (['long', 'buy', 'b'].includes(normalized)) {
    return 'Buy';
  }
  if (['short', 'sell', 's'].includes(normalized)) {
    return 'Sell';
  }
  return '';
};

const normalizeString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

export function isTopstepHeader(headers: string[]): boolean {
  const required = [
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

  const normalized = headers.map(header => header.trim().toLowerCase());
  return required.every(key => normalized.includes(key.toLowerCase()));
}

export function mapTopstepRow(row: TopstepRow, accountName = 'Topstep'): TargetTrade {
  const id = normalizeString(row.Id);
  const createdAt = toISODateTime(row.EnteredAt ?? '');
  const filledAt = toISODateTime(row.ExitedAt ?? '');
  const fallbackTradeDay = createdAt ? createdAt.slice(0, 10) : '';
  const tradeDay = toISODate(row.TradeDay ?? fallbackTradeDay);

  return {
    Id: id,
    AccountName: accountName,
    ContractName: normalizeString(row.ContractName),
    Status: 'Filled',
    Type: 'Market',
    Size: normalizeString(row.Size),
    Side: dirToSide(row.Type),
    CreatedAt: createdAt,
    TradeDay: tradeDay,
    FilledAt: filledAt,
    CancelledAt: '',
    StopPrice: '',
    LimitPrice: '',
    ExecutePrice: normalizeString(row.EntryPrice),
    PositionDisposition: 'Closed',
    CreationDisposition: 'Imported',
    RejectionReason: '',
    ExchangeOrderId: '',
    PlatformOrderId: id,
  };
}
