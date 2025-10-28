const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, X-Client-Info',
};

interface MarketDataRequest {
  symbol: string;
  from: string;
  to: string;
  timeframe?: string;
  provider?: string;
}

interface MarketBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ProviderName = 'polygon' | 'synthetic';

denoServe();

function denoServe() {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const payload = await parseRequest(req);
      validatePayload(payload);

      const provider = resolveProvider(payload.provider);
      const bars = await fetchFromProvider(provider, payload);

      return new Response(
        JSON.stringify({ data: bars, provider }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('fetch-market-data error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }
  });
}

async function parseRequest(req: Request): Promise<MarketDataRequest> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    return {
      symbol: url.searchParams.get('symbol') ?? '',
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
      timeframe: url.searchParams.get('timeframe') ?? undefined,
      provider: url.searchParams.get('provider') ?? undefined,
    };
  }

  const body = await req.json().catch(() => ({}));
  return body as MarketDataRequest;
}

function validatePayload(payload: MarketDataRequest) {
  if (!payload.symbol) throw new Error('Missing symbol');
  if (!payload.from) throw new Error('Missing from timestamp');
  if (!payload.to) throw new Error('Missing to timestamp');
}

function resolveProvider(provider?: string): ProviderName {
  const envProvider = Deno.env.get('MARKET_DATA_PROVIDER')?.toLowerCase();
  const requested = provider?.toLowerCase();
  const candidate = (requested || envProvider || 'polygon') as ProviderName;
  return candidate === 'polygon' ? 'polygon' : 'synthetic';
}

async function fetchFromProvider(provider: ProviderName, params: MarketDataRequest): Promise<MarketBar[]> {
  switch (provider) {
    case 'polygon':
      return await fetchFromPolygon(params);
    default:
      return generateSyntheticBars(params);
  }
}

async function fetchFromPolygon(params: MarketDataRequest): Promise<MarketBar[]> {
  const apiKey = Deno.env.get('POLYGON_API_KEY');
  if (!apiKey) {
    console.warn('Missing POLYGON_API_KEY, using synthetic data instead.');
    return generateSyntheticBars(params);
  }

  const { multiplier, timespan } = mapTimeframe(params.timeframe ?? '1m');
  const fromDate = params.from.split('T')[0];
  const toDate = params.to.split('T')[0];

  const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${params.symbol}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`);
  url.searchParams.set('adjusted', 'true');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('limit', '5000');
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.warn('Polygon request failed with status', response.status);
    return generateSyntheticBars(params);
  }

  const json = await response.json();
  const results = Array.isArray(json.results) ? json.results : [];

  if (results.length === 0) {
    return generateSyntheticBars(params);
  }

  return results.map((bar: any) => ({
    time: new Date(bar.t).toISOString(),
    open: Number(bar.o ?? bar.open ?? 0),
    high: Number(bar.h ?? bar.high ?? 0),
    low: Number(bar.l ?? bar.low ?? 0),
    close: Number(bar.c ?? bar.close ?? 0),
    volume: Number(bar.v ?? bar.volume ?? 0),
  }));
}

function mapTimeframe(timeframe: string): { multiplier: number; timespan: string } {
  const mapping: Record<string, { multiplier: number; timespan: string }> = {
    '1m': { multiplier: 1, timespan: 'minute' },
    '3m': { multiplier: 3, timespan: 'minute' },
    '5m': { multiplier: 5, timespan: 'minute' },
    '15m': { multiplier: 15, timespan: 'minute' },
    '30m': { multiplier: 30, timespan: 'minute' },
    '1h': { multiplier: 1, timespan: 'hour' },
    '4h': { multiplier: 4, timespan: 'hour' },
    '1d': { multiplier: 1, timespan: 'day' },
  };

  return mapping[timeframe.toLowerCase()] ?? { multiplier: 1, timespan: 'minute' };
}

function generateSyntheticBars(params: MarketDataRequest): MarketBar[] {
  const fromTs = Date.parse(params.from);
  const toTs = Date.parse(params.to);
  const duration = Math.max(toTs - fromTs, 60 * 60 * 1000);
  const intervals = Math.min(Math.floor(duration / (60 * 1000)), 720);
  const basePrice = 100 + (params.symbol.length % 10) * 5;

  const bars: MarketBar[] = [];
  let currentPrice = basePrice;
  let currentTime = fromTs;
  const step = Math.max(Math.floor(duration / Math.max(intervals, 1)), 60 * 1000);

  while (currentTime <= toTs) {
    const drift = (Math.random() - 0.5) * 0.8;
    const open = currentPrice;
    const close = Math.max(1, open * (1 + drift / 100));
    const high = Math.max(open, close) * (1 + Math.random() * 0.002);
    const low = Math.min(open, close) * (1 - Math.random() * 0.002);
    const volume = 500 + Math.round(Math.random() * 1500);

    bars.push({
      time: new Date(currentTime).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
    currentTime += step;
  }

  return bars;
}
