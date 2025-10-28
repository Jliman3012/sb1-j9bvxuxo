import { fetchFromPolygon, MarketDataBar } from './providers/polygon.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MarketDataResponse {
  data: MarketDataBar[];
  source: 'polygon' | 'synthetic';
}

interface QueryParams {
  symbol: string;
  from: string;
  to: string;
  tf: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = getQueryParams(new URL(req.url));
    validateParams(params);

    let bars: MarketDataBar[] = [];
    let source: MarketDataResponse['source'] = 'polygon';

    try {
      bars = await fetchFromPolygon({
        symbol: params.symbol,
        from: params.from,
        to: params.to,
        interval: params.tf,
      });
    } catch (error) {
      console.error('Failed to fetch polygon data:', error);
      bars = [];
    }

    if (!bars.length) {
      source = 'synthetic';
      bars = generateSyntheticSeries(params);
    }

    const payload: MarketDataResponse = { data: bars, source };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-market-data error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getQueryParams(url: URL): QueryParams {
  return {
    symbol: url.searchParams.get('symbol') ?? '',
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
    tf: url.searchParams.get('tf') ?? '1m',
  };
}

function validateParams(params: QueryParams) {
  if (!params.symbol) {
    throw new Error('symbol is required');
  }
  if (!params.from || Number.isNaN(Date.parse(params.from))) {
    throw new Error('from timestamp is invalid');
  }
  if (!params.to || Number.isNaN(Date.parse(params.to))) {
    throw new Error('to timestamp is invalid');
  }
}

function generateSyntheticSeries(params: QueryParams): MarketDataBar[] {
  const start = Date.parse(params.from);
  const end = Date.parse(params.to);
  const intervalMs = resolveInterval(params.tf);

  const bars: MarketDataBar[] = [];
  const basePrice = 100 + Math.random() * 50;
  let currentPrice = basePrice;

  for (let ts = start; ts <= end; ts += intervalMs) {
    const drift = (Math.random() - 0.5) * 0.5;
    const open = currentPrice;
    currentPrice = Math.max(1, currentPrice + drift);
    const high = Math.max(open, currentPrice) + Math.random();
    const low = Math.min(open, currentPrice) - Math.random();
    const close = currentPrice;

    bars.push({
      time: Math.floor(ts / 1000),
      open: roundTwo(open),
      high: roundTwo(high),
      low: roundTwo(low),
      close: roundTwo(close),
      volume: Math.floor(500 + Math.random() * 1500),
    });
  }

  return bars;
}

function resolveInterval(tf: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1D': 86_400_000,
  };
  return map[tf] ?? map['1m'];
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
