import { z } from 'zod';

export const TARGET_HEADERS = [
  'Id',
  'AccountName',
  'ContractName',
  'Status',
  'Type',
  'Size',
  'Side',
  'CreatedAt',
  'TradeDay',
  'FilledAt',
  'CancelledAt',
  'StopPrice',
  'LimitPrice',
  'ExecutePrice',
  'PositionDisposition',
  'CreationDisposition',
  'RejectionReason',
  'ExchangeOrderId',
  'PlatformOrderId',
] as const;

export type TargetHeader = (typeof TARGET_HEADERS)[number];

const baseAliasMap: Record<TargetHeader, string[]> = {
  Id: ['id', 'trade id', 'order id', 'transaction id', 'ticket'],
  AccountName: ['account', 'account name', 'account id', 'acct'],
  ContractName: ['symbol', 'ticker', 'instrument', 'contract', 'market', 'product'],
  Status: ['status', 'filled', 'closed', 'open', 'executed'],
  Type: ['order_type', 'type', 'market/limit', 'mkt/lim', 'order type'],
  Size: ['qty', 'quantity', 'contracts', 'shares', 'lot', 'lots', 'volume'],
  Side: ['side', 'buy/sell', 'b/s', 'action', 'direction', 'longshort'],
  CreatedAt: ['entry time', 'creation time', 'submitted at', 'time', 'date/time', 'order time'],
  TradeDay: ['trade date', 'session date', 'day', 'date'],
  FilledAt: ['exit time', 'fill time', 'closed at', 'closed time', 'execution time'],
  CancelledAt: ['cancelled at', 'cancel time', 'cancelled'],
  StopPrice: ['stop', 'stp', 'sl', 'stop price', 'stop loss'],
  LimitPrice: ['limit', 'lmt', 'tp', 'target price'],
  ExecutePrice: ['avg price', 'fill price', 'execution price', 'price', 'avg fill'],
  PositionDisposition: ['position disposition', 'position state'],
  CreationDisposition: ['creation disposition', 'creation state'],
  RejectionReason: ['rejection reason', 'reject reason', 'error'],
  ExchangeOrderId: ['exec id', 'exchange id', 'order id (exchange)'],
  PlatformOrderId: ['platform id', 'client order id', 'clordid', 'broker id'],
};

const aliasNormalizer = (alias: string) =>
  alias
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const aliasSchema = z.array(z.string());

export const headerAliasMap: Record<TargetHeader, RegExp[]> = Object.entries(baseAliasMap).reduce(
  (acc, [target, aliases]) => {
    acc[target as TargetHeader] = aliasSchema
      .parse(aliases)
      .map(alias => aliasNormalizer(alias))
      .map(alias => new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    return acc;
  },
  Object.fromEntries(TARGET_HEADERS.map(header => [header, [] as RegExp[]])) as Record<TargetHeader, RegExp[]>,
);

export const normalizedHeaderLookup: Record<string, TargetHeader> = (() => {
  const map: Record<string, TargetHeader> = {};

  const push = (header: TargetHeader, variant: string) => {
    const normalized = aliasNormalizer(variant);
    if (!map[normalized]) {
      map[normalized] = header;
    }
  };

  TARGET_HEADERS.forEach(header => {
    push(header, header);
    baseAliasMap[header].forEach(alias => push(header, alias));
  });

  return map;
})();

export const normalizeHeader = (rawHeader: string): TargetHeader | null => {
  const normalized = aliasNormalizer(rawHeader);
  if (!normalized) {
    return null;
  }

  const direct = normalizedHeaderLookup[normalized];
  if (direct) {
    return direct;
  }

  for (const [header, patterns] of Object.entries(headerAliasMap) as [TargetHeader, RegExp[]][]) {
    if (patterns.some(pattern => pattern.test(normalized))) {
      return header;
    }
  }

  if (normalized.includes('entry') && normalized.includes('date')) {
    return 'CreatedAt';
  }

  if (normalized.includes('entry') && normalized.includes('time')) {
    return 'CreatedAt';
  }

  if (normalized.includes('exit') && normalized.includes('time')) {
    return 'FilledAt';
  }

  if (normalized.includes('exit') && normalized.includes('date')) {
    return 'FilledAt';
  }

  return null;
};

export type ManualHeaderMap = Partial<Record<string, TargetHeader>>;

