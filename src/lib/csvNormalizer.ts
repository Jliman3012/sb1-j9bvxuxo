export interface TargetFormat {
  Id: string;
  AccountName: string;
  ContractName: string;
  Status: string;
  Type: string;
  Size: string;
  Side: string;
  CreatedAt: string;
  TradeDay: string;
  FilledAt: string;
  CancelledAt: string;
  StopPrice: string;
  LimitPrice: string;
  ExecutePrice: string;
  PositionDisposition: string;
  CreationDisposition: string;
  RejectionReason: string;
  ExchangeOrderId: string;
  PlatformOrderId: string;
}

export interface ColumnMapping {
  [key: string]: string[];
}

const COLUMN_MAPPINGS: ColumnMapping = {
  Id: ['id', 'order_id', 'orderid', 'trade_id', 'tradeid', 'transaction_id'],
  AccountName: ['account_name', 'accountname', 'account', 'account_id', 'accountid'],
  ContractName: ['contract_name', 'contractname', 'contract', 'symbol', 'instrument', 'ticker', 'asset'],
  Status: ['status', 'order_status', 'orderstatus', 'state', 'order_state'],
  Type: ['type', 'order_type', 'ordertype', 'order_kind'],
  Size: ['size', 'quantity', 'qty', 'amount', 'volume', 'contracts', 'shares'],
  Side: ['side', 'direction', 'action', 'buy_sell', 'buysell', 'trade_type'],
  CreatedAt: ['created_at', 'createdat', 'created', 'order_time', 'time_placed', 'entry_time', 'order_date', 'enteredat', 'entered_at'],
  TradeDay: ['trade_day', 'tradeday', 'date', 'trading_date', 'tradingdate', 'day'],
  FilledAt: ['filled_at', 'filledat', 'filled', 'execution_time', 'fill_time', 'executed_at', 'exitedat', 'exited_at'],
  CancelledAt: ['cancelled_at', 'cancelledat', 'cancelled', 'cancel_time'],
  StopPrice: ['stop_price', 'stopprice', 'stop', 'stop_loss', 'stoploss'],
  LimitPrice: ['limit_price', 'limitprice', 'limit', 'limit_order'],
  ExecutePrice: ['execute_price', 'executeprice', 'execution_price', 'fill_price', 'fillprice', 'price', 'avg_price', 'avgprice', 'entryprice', 'entry_price', 'exitprice', 'exit_price'],
  PositionDisposition: ['position_disposition', 'position', 'position_type'],
  CreationDisposition: ['creation_disposition', 'creation', 'order_source'],
  RejectionReason: ['rejection_reason', 'rejectionreason', 'reject_reason', 'error', 'error_message'],
  ExchangeOrderId: ['exchange_order_id', 'exchangeorderid', 'exchange_id', 'exchangeid'],
  PlatformOrderId: ['platform_order_id', 'platformorderid', 'platform_id', 'platformid', 'broker_id'],
};

const BROKER_PRESETS: { [key: string]: { [key: string]: string } } = {
  ninjatrader: {
    'Instrument': 'ContractName',
    'Qty': 'Size',
    'Action': 'Side',
    'Time': 'CreatedAt',
    'Avg fill price': 'ExecutePrice',
    'Order': 'Type',
  },
  topstep: {
    'Symbol': 'ContractName',
    'Quantity': 'Size',
    'Buy/Sell': 'Side',
    'Entry Time': 'CreatedAt',
    'Fill Price': 'ExecutePrice',
    'Order Type': 'Type',
  },
  tradeovate: {
    'Contract': 'ContractName',
    'Contracts': 'Size',
    'B/S': 'Side',
    'Time': 'CreatedAt',
    'Price': 'ExecutePrice',
  },
  interactivebrokers: {
    'Symbol': 'ContractName',
    'Quantity': 'Size',
    'T. Price': 'ExecutePrice',
    'Buy/Sell': 'Side',
    'Date/Time': 'CreatedAt',
  },
};

export function normalizeColumnName(colName: string): string {
  const normalized = colName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');

  for (const [targetCol, aliases] of Object.entries(COLUMN_MAPPINGS)) {
    if (aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return targetCol;
    }
  }

  return colName;
}

export function detectBrokerFormat(headers: string[]): string | null {
  const headerStr = headers.map(h => h.toLowerCase()).join(',');

  if (headerStr.includes('ninjatrader') || (headers.includes('Instrument') && headers.includes('Avg fill price'))) {
    return 'ninjatrader';
  }

  if (headerStr.includes('topstep') || (headers.includes('Symbol') && headers.includes('Fill Price'))) {
    return 'topstep';
  }

  if (headers.includes('Contract') && headers.includes('B/S')) {
    return 'tradeovate';
  }

  if (headers.includes('T. Price') || headerStr.includes('interactive brokers')) {
    return 'interactivebrokers';
  }

  return null;
}

export function normalizeDateString(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';

  try {
    let cleanedDate = dateStr.trim();

    const tzMatch = cleanedDate.match(/(.+)\s*([+-]\d{2}:\d{2})$/);
    if (tzMatch) {
      cleanedDate = tzMatch[1].trim();
    }

    const mdyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/;
    const mdyMatch = cleanedDate.match(mdyPattern);

    if (mdyMatch) {
      const [, month, day, year, hour, minute, second] = mdyMatch;
      const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}Z`;
      return isoString;
    }

    const date = new Date(cleanedDate);

    if (isNaN(date.getTime())) {
      console.warn('\u26a0\ufe0f Failed to parse date:', dateStr);
      return dateStr;
    }

    return date.toISOString();
  } catch (error) {
    console.warn('\u26a0\ufe0f Error parsing date:', dateStr, error);
    return dateStr;
  }
}

export function normalizeSideValue(side: string): string {
  const normalized = side.toLowerCase().trim();

  if (['buy', 'b', 'long', 'bought'].includes(normalized)) {
    return 'Buy';
  }

  if (['sell', 's', 'short', 'sold'].includes(normalized)) {
    return 'Sell';
  }

  return side;
}

export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.some(field => field !== '')) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
      }
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some(field => field !== '')) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export function normalizeCSV(csvText: string): { normalized: string; stats: { rowsProcessed: number; columnsMatched: number; broker: string | null } } {
  const lines = parseCSV(csvText);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = lines[0];
  const broker = detectBrokerFormat(headers);

  const columnMap: { [key: string]: number } = {};
  const targetHeaders = Object.keys(COLUMN_MAPPINGS);

  if (broker && BROKER_PRESETS[broker]) {
    const preset = BROKER_PRESETS[broker];
    headers.forEach((header, index) => {
      if (preset[header]) {
        columnMap[preset[header]] = index;
      }
    });
  }

  headers.forEach((header, index) => {
    const normalized = normalizeColumnName(header);
    if (targetHeaders.includes(normalized)) {
      columnMap[normalized] = index;
    }
  });

  const targetHeadersOrdered = [
    'Id', 'AccountName', 'ContractName', 'Status', 'Type', 'Size', 'Side',
    'CreatedAt', 'TradeDay', 'FilledAt', 'CancelledAt', 'StopPrice', 'LimitPrice',
    'ExecutePrice', 'PositionDisposition', 'CreationDisposition', 'RejectionReason',
    'ExchangeOrderId', 'PlatformOrderId'
  ];

  const normalizedLines: string[][] = [targetHeadersOrdered];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];

    if (row.every(cell => cell === '') || row.length < 2) {
      continue;
    }

    const normalizedRow: string[] = [];

    for (const targetHeader of targetHeadersOrdered) {
      const sourceIndex = columnMap[targetHeader];
      let value = sourceIndex !== undefined ? row[sourceIndex] : '';

      if (targetHeader === 'Status' && !value) {
        value = 'Filled';
      }

      if (targetHeader === 'Type' && !value) {
        value = 'Market';
      }

      if (['CreatedAt', 'FilledAt', 'CancelledAt', 'TradeDay'].includes(targetHeader) && value) {
        value = normalizeDateString(value);
      }

      if (targetHeader === 'Side' && value) {
        value = normalizeSideValue(value);
      }

      if (targetHeader === 'Id' && !value) {
        value = `ORDER_${Date.now()}_${i}`;
      }

      normalizedRow.push(value);
    }

    normalizedLines.push(normalizedRow);
  }

  const csvOutput = normalizedLines.map(row =>
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');

  return {
    normalized: csvOutput,
    stats: {
      rowsProcessed: normalizedLines.length - 1,
      columnsMatched: Object.keys(columnMap).length,
      broker: broker || 'unknown',
    },
  };
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
