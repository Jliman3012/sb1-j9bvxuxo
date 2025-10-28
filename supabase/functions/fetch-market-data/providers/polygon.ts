export interface MarketDataRequest {
  symbol: string;
  from: string;
  to: string;
  interval: string;
}

export interface MarketDataBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const SUPPORTED_INTERVALS: Record<string, { multiplier: number; timespan: string }> = {
  '1m': { multiplier: 1, timespan: 'minute' },
  '5m': { multiplier: 5, timespan: 'minute' },
  '15m': { multiplier: 15, timespan: 'minute' },
  '1h': { multiplier: 1, timespan: 'hour' },
  '4h': { multiplier: 4, timespan: 'hour' },
  '1D': { multiplier: 1, timespan: 'day' },
};

export async function fetchFromPolygon(params: MarketDataRequest): Promise<MarketDataBar[]> {
  const apiKey = Deno.env.get('POLYGON_API_KEY');
  if (!apiKey) {
    console.warn('POLYGON_API_KEY is not set. Falling back to synthetic data.');
    return [];
  }

  const interval = SUPPORTED_INTERVALS[params.interval] ?? SUPPORTED_INTERVALS['1m'];
  const fromDate = new Date(params.from);
  const toDate = new Date(params.to);

  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(params.symbol)}/range/${interval.multiplier}/${interval.timespan}/${fromIso}/${toIso}`);
  url.searchParams.set('adjusted', 'true');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('limit', '5000');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error('Polygon API error:', response.status, await response.text());
    return [];
  }

  const payload = await response.json();
  if (!payload?.results || !Array.isArray(payload.results)) {
    return [];
  }

  return payload.results.map((bar: any) => ({
    time: Math.floor(Number(bar.t) / 1000),
    open: Number(bar.o),
    high: Number(bar.h),
    low: Number(bar.l),
    close: Number(bar.c),
    volume: Number(bar.v ?? 0),
  }));
}
