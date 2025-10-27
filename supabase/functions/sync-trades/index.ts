import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TradeData {
  symbol: string;
  trade_type: 'long' | 'short';
  entry_date: string;
  exit_date?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  pnl: number;
  pnl_percentage: number;
  fees: number;
  status: 'open' | 'closed';
}

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    const { account_id } = await req.json();

    if (!account_id) {
      throw new Error('Missing account_id');
    }

    const { data: account, error: accountError } = await supabase
      .from('broker_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error('Account not found or access denied');
    }

    if (!account.api_enabled || !account.api_key) {
      throw new Error('API integration not enabled for this account');
    }

    const syncStartTime = new Date().toISOString();
    let tradesImported = 0;
    let syncStatus: 'success' | 'error' | 'partial' = 'success';
    let errorMessage = '';

    try {
      const trades = await fetchTradesFromBroker(account);

      for (const trade of trades) {
        const existingTrade = await supabase
          .from('trades')
          .select('id')
          .eq('user_id', user.id)
          .eq('account_id', account_id)
          .eq('symbol', trade.symbol)
          .eq('entry_date', trade.entry_date)
          .maybeSingle();

        if (!existingTrade.data) {
          const { error: insertError } = await supabase.from('trades').insert({
            user_id: user.id,
            account_id: account_id,
            ...trade,
          });

          if (!insertError) {
            tradesImported++;
          }
        }
      }
    } catch (error) {
      syncStatus = 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    }

    await supabase.from('sync_logs').insert({
      account_id: account_id,
      user_id: user.id,
      sync_status: syncStatus,
      trades_imported: tradesImported,
      error_message: errorMessage || null,
      started_at: syncStartTime,
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: syncStatus === 'success',
        trades_imported: tradesImported,
        error: errorMessage || null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
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

async function fetchTradesFromBroker(account: any): Promise<TradeData[]> {
  const brokerName = account.broker_name.toLowerCase();

  if (brokerName.includes('topstep')) {
    return await fetchTopstepTrades(account);
  }

  if (brokerName.includes('tradovate')) {
    return await fetchTradovateTrades(account);
  }

  return [];
}

async function fetchTopstepTrades(account: any): Promise<TradeData[]> {
  const endpoint = account.api_endpoint || 'https://api.topstepfx.com/v1/trades';
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${account.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TopstepFX API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.trades.map((trade: any) => ({
      symbol: trade.instrument || trade.symbol,
      trade_type: trade.side === 'buy' ? 'long' : 'short',
      entry_date: trade.open_time || trade.entry_time,
      exit_date: trade.close_time || trade.exit_time || null,
      entry_price: parseFloat(trade.open_price || trade.entry_price),
      exit_price: trade.close_price ? parseFloat(trade.close_price) : null,
      quantity: parseFloat(trade.quantity || trade.size),
      pnl: parseFloat(trade.profit_loss || trade.pnl || 0),
      pnl_percentage: parseFloat(trade.profit_loss_percentage || 0),
      fees: parseFloat(trade.commission || trade.fees || 0),
      status: trade.status === 'open' ? 'open' : 'closed',
    }));
  } catch (error) {
    console.error('TopstepFX fetch error:', error);
    throw new Error('Failed to fetch trades from TopstepFX');
  }
}

async function fetchTradovateTrades(account: any): Promise<TradeData[]> {
  const endpoint = account.api_endpoint || 'https://api.tradovate.com/v1/fills';
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${account.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Tradovate API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.fills.map((fill: any) => ({
      symbol: fill.contractName || fill.symbol,
      trade_type: fill.action === 'Buy' ? 'long' : 'short',
      entry_date: fill.timestamp,
      exit_date: null,
      entry_price: parseFloat(fill.price),
      exit_price: null,
      quantity: parseInt(fill.qty),
      pnl: 0,
      pnl_percentage: 0,
      fees: parseFloat(fill.commission || 0),
      status: 'closed',
    }));
  } catch (error) {
    console.error('Tradovate fetch error:', error);
    throw new Error('Failed to fetch trades from Tradovate');
  }
}
