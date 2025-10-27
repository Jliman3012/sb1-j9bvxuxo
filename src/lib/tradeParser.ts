import { parseCSV } from './csvNormalizer';

interface ParsedTrade {
  symbol: string;
  trade_type: 'long' | 'short';
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  fees: number;
  notes: string | null;
}

export function parseNormalizedCSV(text: string): ParsedTrade[] {
  console.log('🔍 Starting CSV parsing...');

  const lines = parseCSV(text);

  if (lines.length < 2) {
    console.error('❌ CSV file is empty or has no data rows');
    throw new Error('CSV file is empty or invalid');
  }

  const headers = lines[0].map(h => h.trim().toLowerCase());
  console.log('📋 CSV Headers:', headers);

  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length === 0 || values.every(v => v === '')) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  console.log('📊 Total rows parsed:', rows.length);

  if (rows.length === 0) {
    console.error('❌ No data rows found in CSV');
    throw new Error('CSV file contains no data rows. Please check your file.');
  }

  const hasEntryExit = headers.includes('entryprice') && headers.includes('exitprice');
  const hasEnteredExited = headers.includes('enteredat') && headers.includes('exitedat');
  const hasExecutePrice = headers.includes('executeprice');
  const isCompleteTradeFormat = hasEntryExit || hasEnteredExited;

  console.log('🔍 Format detection:', {
    hasEntryExit,
    hasEnteredExited,
    hasExecutePrice,
    isCompleteTradeFormat,
    headers: headers.join(', ')
  });

  const trades: ParsedTrade[] = [];

  if (isCompleteTradeFormat) {
    console.log('✅ Detected complete trade format (each row = 1 trade)');

    rows.forEach((row, index) => {
      const symbol = row.contractname || row.symbol || row.instrument;
      const tradeType = row.type || row.side || row.direction;
      const size = parseInt(row.size || row.quantity || row.qty) || 1;
      const entryPrice = parseFloat(row.entryprice || row.entry_price || row.executeprice) || 0;
      const exitPrice = parseFloat(row.exitprice || row.exit_price) || null;
      const entryDate = row.enteredat || row.createdat || row.entry_time || row.tradeday;
      const exitDate = row.exitedat || row.exit_time || row.filledat;
      const fees = parseFloat(row.fees || row.commissions) || 0;
      const pnl = parseFloat(row.pnl || row.profit) || 0;

      if (!symbol) {
        console.log(`⚠️ Row ${index + 1}: Missing symbol (checked: contractname, symbol, instrument)`);
        console.log(`   Available fields:`, Object.keys(row).join(', '));
        return;
      }

      if (!entryPrice) {
        console.log(`⚠️ Row ${index + 1}: Missing entry price (checked: entryprice, entry_price, executeprice)`);
        return;
      }

      const isShort = ['short', 's', 'sell', 'ask'].includes(tradeType?.toLowerCase());

      trades.push({
        symbol: symbol.toUpperCase(),
        trade_type: isShort ? 'short' : 'long',
        entry_date: entryDate || new Date().toISOString(),
        exit_date: exitDate || null,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: size,
        fees: fees,
        notes: pnl ? `P&L: $${pnl.toFixed(2)}` : null,
      });

      console.log(`  ✅ Trade ${index + 1}:`, {
        symbol: symbol.toUpperCase(),
        type: isShort ? 'short' : 'long',
        entry: entryPrice,
        exit: exitPrice,
        qty: size
      });
    });
  } else {
    console.log('✅ Detected order-based format (pairs opening/closing orders)');

    const hasStatus = headers.includes('status');
    const hasContractName = headers.includes('contractname');

    if (!hasContractName) {
      console.error('❌ Missing required column: ContractName (or Symbol/Instrument)');
      console.log('📋 Available columns:', headers.join(', '));
      throw new Error(`Missing required column 'ContractName'. Your CSV has: ${headers.join(', ')}`);
    }

    if (!hasExecutePrice) {
      console.error('❌ Missing required column: ExecutePrice');
      console.log('📋 Available columns:', headers.join(', '));
      throw new Error(`Missing required column 'ExecutePrice'. Your CSV has: ${headers.join(', ')}`);
    }

    const orders = rows.filter((row, index) => {
      const hasValidStatus = !hasStatus || row.status?.toLowerCase() === 'filled';
      const hasContract = row.contractname;
      const hasPrice = row.executeprice;

      if (!hasValidStatus || !hasContract || !hasPrice) {
        console.log(`⚠️ Skipping row ${index + 1}:`, {
          status: row.status,
          contractname: row.contractname,
          executeprice: row.executeprice,
          hasValidStatus,
          hasContract,
          hasPrice
        });
      }

      return hasValidStatus && hasContract && hasPrice;
    });

    console.log('📋 Filtered to', orders.length, 'valid orders from', rows.length, 'total rows');

    if (orders.length === 0 && rows.length > 0) {
      console.error('❌ No valid orders found. Checked conditions:');
      console.log('  - Status must be "Filled" (if Status column exists)');
      console.log('  - ContractName must have a value');
      console.log('  - ExecutePrice must have a value');
      console.log('📋 First row sample:', rows[0]);
      throw new Error('No valid orders found. Please check that your CSV has Status=Filled, ContractName, and ExecutePrice columns with values.');
    }

    const hasPositionDisposition = headers.includes('positiondisposition');

    if (hasPositionDisposition) {
      const tradeMap = new Map<string, any>();

      orders.forEach((order, index) => {
        const symbol = order.contractname;
        const side = order.side;
        const positionDisposition = order.positiondisposition?.toLowerCase();
        const size = parseInt(order.size) || 0;
        const executePrice = parseFloat(order.executeprice) || 0;
        const filledAt = order.filledat || order.createdat || order.tradeday;

        console.log(`  Order ${index + 1}:`, {
          symbol,
          side,
          positionDisposition,
          size,
          executePrice
        });

        if (positionDisposition === 'opening') {
          const key = `${symbol}_${filledAt}_${index}`;
          tradeMap.set(key, {
            symbol,
            side,
            size,
            entryPrice: executePrice,
            entryDate: filledAt,
            exitPrice: null,
            exitDate: null,
          });
        } else if (positionDisposition === 'closing') {
          let foundOpening = false;
          for (const [key, trade] of tradeMap.entries()) {
            if (trade.symbol === symbol && trade.side !== side && trade.size === size && !trade.exitPrice) {
              trade.exitPrice = executePrice;
              trade.exitDate = filledAt;
              foundOpening = true;
              console.log(`    ✅ Paired closing order with opening`);
              break;
            }
          }

          if (!foundOpening) {
            const key = `${symbol}_closed_${filledAt}_${index}`;
            tradeMap.set(key, {
              symbol,
              side,
              size,
              entryPrice: executePrice,
              entryDate: filledAt,
              exitPrice: executePrice,
              exitDate: filledAt,
            });
            console.log(`    ⚠️ Closing order without opening - creating standalone trade`);
          }
        }
      });

      console.log('📊 Created', tradeMap.size, 'trade entries from order pairs');

      tradeMap.forEach(trade => {
        const isShort = ['ask', 'sell', 'short', 's'].includes(trade.side?.toLowerCase());

        trades.push({
          symbol: trade.symbol.toUpperCase(),
          trade_type: isShort ? 'short' : 'long',
          entry_date: trade.entryDate || new Date().toISOString(),
          exit_date: trade.exitDate,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          quantity: trade.size,
          fees: 0,
          notes: null,
        });
      });
    } else {
      console.log('⚠️ No PositionDisposition column - treating each filled order as a complete trade');

      orders.forEach((order, index) => {
        const symbol = order.contractname;
        const side = order.side || order.type;
        const size = parseInt(order.size || order.quantity) || 1;
        const executePrice = parseFloat(order.executeprice || order.price) || 0;
        const filledAt = order.filledat || order.createdat || order.tradeday;

        const isShort = ['ask', 'sell', 'short', 's'].includes(side?.toLowerCase());

        trades.push({
          symbol: symbol.toUpperCase(),
          trade_type: isShort ? 'short' : 'long',
          entry_date: filledAt || new Date().toISOString(),
          exit_date: null,
          entry_price: executePrice,
          exit_price: null,
          quantity: size,
          fees: 0,
          notes: 'Imported as open position',
        });

        console.log(`  ✅ Trade ${index + 1}:`, {
          symbol: symbol.toUpperCase(),
          type: isShort ? 'short' : 'long',
          price: executePrice,
          qty: size
        });
      });
    }
  }

  if (trades.length === 0) {
    console.error('❌ No valid trades could be created from CSV');
    console.log('🔍 Debug info:');
    console.log('  Headers:', headers.join(', '));
    console.log('  Total rows:', rows.length);
    console.log('  Format type:', isCompleteTradeFormat ? 'Complete trades' : 'Order-based');

    if (rows.length > 0) {
      console.log('  First row sample:', rows[0]);
    }

    throw new Error(
      `No valid trades found in CSV. ` +
      `Detected ${isCompleteTradeFormat ? 'complete trade' : 'order-based'} format with ${rows.length} rows. ` +
      `Please ensure your CSV has the required columns: ContractName (or Symbol) and either EntryPrice/ExitPrice or ExecutePrice.`
    );
  }

  console.log('✅ Successfully parsed', trades.length, 'trades');
  return trades;
}
