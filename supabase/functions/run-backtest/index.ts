import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Invalid authorization token');
    }

    const { user_id, strategy_name, symbol, timeframe, initial_capital } = await req.json();

    if (!user_id || !strategy_name || !symbol || !timeframe || !initial_capital) {
      throw new Error('Missing required fields');
    }

    if (user.id !== user_id) {
      throw new Error('Unauthorized');
    }

    const marketData = await fetchMarketData(symbol, timeframe);

    if (!marketData || marketData.length === 0) {
      throw new Error('Failed to fetch market data');
    }

    const results = await runBacktest(marketData, initial_capital);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: backtest, error: insertError } = await supabaseAdmin
      .from('backtests')
      .insert({
        user_id,
        strategy_id: null,
        instrument_id: null,
        name: strategy_name,
        start_date: marketData[0].timestamp.split('T')[0],
        end_date: marketData[marketData.length - 1].timestamp.split('T')[0],
        initial_capital,
        timeframe,
        status: 'completed',
        total_trades: results.total_trades,
        winning_trades: results.winning_trades,
        losing_trades: results.losing_trades,
        total_pnl: results.total_pnl,
        win_rate: results.win_rate,
        profit_factor: results.profit_factor,
        max_drawdown: results.max_drawdown,
        sharpe_ratio: results.sharpe_ratio,
        results: { trades: results.trades, symbol, timeframe },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        backtest,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Backtest error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function fetchMarketData(symbol: string, timeframe: string) {
  try {
    const interval = convertTimeframe(timeframe);
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/${interval}/2023-01-01/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=50000`;

    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer demo',
      },
    });

    if (!response.ok) {
      return generateSyntheticData(symbol, timeframe);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return generateSyntheticData(symbol, timeframe);
    }

    return data.results.map((candle: any) => ({
      timestamp: new Date(candle.t).toISOString(),
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      volume: candle.v,
    }));
  } catch (error) {
    console.error('Error fetching market data:', error);
    return generateSyntheticData(symbol, timeframe);
  }
}

function convertTimeframe(timeframe: string): string {
  const mapping: Record<string, string> = {
    '1m': 'minute',
    '5m': 'minute',
    '15m': 'minute',
    '1h': 'hour',
    '4h': 'hour',
    '1D': 'day',
  };
  return mapping[timeframe] || 'day';
}

function generateSyntheticData(symbol: string, timeframe: string): any[] {
  const data: any[] = [];
  const now = Date.now();
  const daysBack = 365;
  const start = now - daysBack * 24 * 60 * 60 * 1000;

  const timeframeMs: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
  };

  const interval = timeframeMs[timeframe] || timeframeMs['1D'];
  let basePrice = getBasePrice(symbol);
  let currentTime = start;

  while (currentTime <= now && data.length < 1000) {
    const volatility = 0.015;
    const trend = 0.0001;
    const change = (Math.random() - 0.5) * 2 * volatility + trend;
    const open = basePrice;
    const close = basePrice * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

    data.push({
      timestamp: new Date(currentTime).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000),
    });

    basePrice = close;
    currentTime += interval;
  }

  return data;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'BTCUSD': 45000,
    'ETHUSD': 3000,
    'AAPL': 180,
    'TSLA': 250,
    'SPY': 450,
    'EURUSD': 1.1,
    'GBPUSD': 1.27,
  };

  return prices[symbol] || 100;
}

async function runBacktest(marketData: any[], initialCapital: number) {
  const trades: any[] = [];
  let capital = initialCapital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  const positionSizePercent = 0.1;
  const takeProfitPercent = 0.02;
  const stopLossPercent = 0.01;
  const fastPeriod = 10;
  const slowPeriod = 20;

  for (let i = slowPeriod; i < marketData.length; i++) {
    const fastSMA = calculateSMA(marketData, i, fastPeriod);
    const slowSMA = calculateSMA(marketData, i, slowPeriod);
    const prevFastSMA = calculateSMA(marketData, i - 1, fastPeriod);
    const prevSlowSMA = calculateSMA(marketData, i - 1, slowPeriod);

    const bullishCross = prevFastSMA <= prevSlowSMA && fastSMA > slowSMA;

    if (bullishCross) {
      const entryPrice = marketData[i].close;
      const positionSize = (capital * positionSizePercent) / entryPrice;
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent);
      const stopLossPrice = entryPrice * (1 - stopLossPercent);

      let exitPrice = 0;
      let exitIndex = i;

      for (let j = i + 1; j < marketData.length; j++) {
        if (marketData[j].high >= takeProfitPrice) {
          exitPrice = takeProfitPrice;
          exitIndex = j;
          break;
        } else if (marketData[j].low <= stopLossPrice) {
          exitPrice = stopLossPrice;
          exitIndex = j;
          break;
        }
      }

      if (exitPrice > 0) {
        const pnl = (exitPrice - entryPrice) * positionSize;
        capital += pnl;

        if (capital > peakCapital) {
          peakCapital = capital;
        }

        const drawdown = peakCapital - capital;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }

        returns.push(pnl / initialCapital);

        trades.push({
          entry_date: marketData[i].timestamp,
          exit_date: marketData[exitIndex].timestamp,
          entry_price: entryPrice,
          exit_price: exitPrice,
          position_size: positionSize,
          pnl,
          trade_type: 'long',
        });

        i = exitIndex;
      }
    }
  }

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl < 0);
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
  ) : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    total_trades: trades.length,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length,
    total_pnl: totalPnL,
    win_rate: winRate,
    profit_factor: profitFactor,
    max_drawdown: maxDrawdown,
    sharpe_ratio: sharpeRatio,
    trades,
  };
}

function calculateSMA(data: any[], endIndex: number, period: number): number {
  const startIndex = Math.max(0, endIndex - period + 1);
  const slice = data.slice(startIndex, endIndex + 1);
  const sum = slice.reduce((acc, bar) => acc + bar.close, 0);
  return sum / slice.length;
}
