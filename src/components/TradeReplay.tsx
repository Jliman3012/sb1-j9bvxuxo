import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, Gauge, TrendingUp, Clock } from 'lucide-react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, type CandlestickData, type SeriesMarker } from 'lightweight-charts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Play, Pause, RotateCcw, ChevronLeft, Gauge, TrendingUp, Clock } from 'lucide-react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  type CandlestickData,
  type SeriesMarker,
} from 'lightweight-charts';
import { awardXpEvent } from '../lib/gamificationEvents';

interface Trade {
  id: string;
  symbol: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  trade_type: 'long' | 'short';
  pnl: number;
  notes: string | null;
  replay_reviewed: boolean;
  stop_price?: number | null;
  initial_risk?: number | null;
  r_multiple?: number | null;
}

interface TickData {
  time: number;
  price: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

interface TradeReplayProps {
  onBack: () => void;
}

interface MarketDataResponse {
  data: MarketBar[];
  source: 'polygon' | 'synthetic';
}

interface MarketBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const REPLAY_XP_VALUE = 10;
const MARKET_DATA_PADDING_MS = 60 * 60 * 1000; // 60 minutes around the trade

export default function TradeReplay({ onBack }: TradeReplayProps) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tickData, setTickData] = useState<TickData[]>([]);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'provider' | 'synthetic'>('synthetic');

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const badgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const candleDataRef = useRef<CandlestickData[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const candleCacheRef = useRef<CandlestickData[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadTrades();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!selectedTrade) {
      disposeChart();
      setTickData([]);
      return;
    }

    initializeChart();

    return () => {
      stopPlayback(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrade?.id]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (badgeTimeoutRef.current) {
        clearTimeout(badgeTimeoutRef.current);
        badgeTimeoutRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      stopPlayback(false);
      disposeChart();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPlaying || tickData.length === 0) {
      stopPlayback();
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const intervalDuration = Math.max(80, 200 / speed);

    intervalRef.current = setInterval(() => {
      setCurrentTick(prev => {
        if (prev >= tickData.length - 1) {
          stopPlayback();
          return prev;
        }
        return prev + 1;
      });
    }, intervalDuration);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, tickData]);

  useEffect(() => {
    if (tickData.length === 0) {
      setCurrentTick(0);
      if (seriesRef.current) {
        seriesRef.current.setData([]);
        seriesRef.current.setMarkers([]);
      }
      return;
    }

    candleCacheRef.current = buildCandles(tickData);
    if (selectedTrade) {
      applyMarkers(selectedTrade, tickData);
    }
    updateVisibleSeries(currentTick);
    chartRef.current?.timeScale().fitContent();
  }, [tickData, selectedTrade]);

  useEffect(() => {
    if (tickData.length === 0) {
      return;
    }
    const nextIndex = Math.min(currentTick, Math.max(tickData.length - 1, 0));
    if (nextIndex !== currentTick) {
      setCurrentTick(nextIndex);
      return;
    }
    updateVisibleSeries(nextIndex);
  }, [currentTick, tickData]);

  const loadTrades = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .not('exit_date', 'is', null)
        .order('entry_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrades(data || []);
    } catch (err) {
      console.error('Error loading trades:', err);
    }
  };

  const initializeChart = () => {
    if (!chartContainerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    chartRef.current = chart;
    seriesRef.current = series;
    resizeObserverRef.current = resizeObserver;
  };

  const disposeChart = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (resizeObserverRef.current && chartContainerRef.current) {
      resizeObserverRef.current.unobserve(chartContainerRef.current);
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    seriesRef.current = null;
  };

  const stopPlayback = (updateState = true) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (updateState) {
      setIsPlaying(false);
    }
  };

  const buildCandles = (ticks: TickData[]): CandlestickData[] => {
    return ticks.map((tick, idx) => {
      const open = tick.open ?? tick.price;
      const close = tick.close ?? (ticks[idx + 1]?.price ?? tick.price);
      const high = tick.high ?? Math.max(open, close, tick.price);
      const low = tick.low ?? Math.min(open, close, tick.price);

      return {
        time: tick.time as UTCTimestamp,
        open,
        high,
        low,
        close,
      };
    });
  };

  const updateVisibleSeries = (index: number) => {
    if (!seriesRef.current) return;

    const endIndex = Math.min(index + 1, candleCacheRef.current.length);
    const visible = candleCacheRef.current.slice(0, endIndex);
    seriesRef.current.setData(visible);
  };

  const applyMarkers = (trade: Trade, ticks: TickData[]) => {
    if (!seriesRef.current || ticks.length === 0) return;

    const entryMarker: SeriesMarker<UTCTimestamp> = {
      time: ticks[0].time as UTCTimestamp,
      position: trade.trade_type === 'long' ? 'belowBar' : 'aboveBar',
      color: '#3b82f6',
      shape: trade.trade_type === 'long' ? 'arrowUp' : 'arrowDown',
      text: `Entry: $${trade.entry_price.toFixed(2)}`,
    };

    const exitMarker: SeriesMarker<UTCTimestamp> | null = trade.exit_price
      ? {
          time: ticks[ticks.length - 1].time as UTCTimestamp,
          position: trade.trade_type === 'long' ? 'aboveBar' : 'belowBar',
          color: trade.pnl >= 0 ? '#10b981' : '#ef4444',
          shape: trade.trade_type === 'long' ? 'arrowDown' : 'arrowUp',
          text: `Exit: $${trade.exit_price.toFixed(2)}`,
        }
      : null;

    const markers: SeriesMarker<UTCTimestamp>[] = exitMarker ? [entryMarker, exitMarker] : [entryMarker];
    seriesRef.current.setMarkers(markers);
  };

  const fetchMarketTicks = async (trade: Trade): Promise<{ ticks: TickData[]; source: 'provider' | 'synthetic' }> => {
    try {
      const entryTime = new Date(trade.entry_date).getTime();
      const exitTime = trade.exit_date ? new Date(trade.exit_date).getTime() : entryTime + MARKET_DATA_PADDING_MS;
      const from = new Date(entryTime - MARKET_DATA_PADDING_MS).toISOString();
      const to = new Date(exitTime + MARKET_DATA_PADDING_MS).toISOString();

      const params = new URLSearchParams({
        symbol: trade.symbol,
        from,
        to,
        tf: '1m',
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-data?${params.toString()}`;
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        console.warn('Market data request failed with status', response.status);
        return { ticks: [], source: 'synthetic' };
      }

      const payload = (await response.json()) as MarketDataResponse;
      const bars = Array.isArray(payload?.data) ? payload.data : [];

      if (!bars.length) {
        return { ticks: [], source: 'synthetic' };
      }

      const ticks: TickData[] = bars.map(bar => ({
        time: bar.time,
        price: bar.close,
        volume: bar.volume,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      return { ticks, source: payload?.source === 'polygon' ? 'provider' : 'synthetic' };
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      return { ticks: [], source: 'synthetic' };
    }
  };

  const generateSyntheticTickData = (trade: Trade): TickData[] => {
    const entryTime = new Date(trade.entry_date).getTime();
    const exitTime = trade.exit_date ? new Date(trade.exit_date).getTime() : entryTime + 3600000;
    const duration = Math.max(exitTime - entryTime, 1);
    const numTicks = Math.min(Math.max(Math.floor(duration / 1000), 50), 500);

    const ticks: TickData[] = [];
    const priceRange = Math.abs((trade.exit_price || trade.entry_price) - trade.entry_price);
    const volatility = priceRange * 0.3 || trade.entry_price * 0.01;

    let currentPrice = trade.entry_price;
    const priceStep = numTicks > 0
      ? ((trade.exit_price || trade.entry_price) - trade.entry_price) / numTicks
      : 0;

    for (let i = 0; i <= Math.max(numTicks, 1); i++) {
      const ratio = numTicks > 0 ? i / numTicks : 0;
      const time = entryTime + (duration * ratio);
    for (let i = 0; i <= numTicks; i++) {
      const time = entryTime + (duration * i) / numTicks;
      const noise = (Math.random() - 0.5) * volatility * 0.3;
      const nextPrice = trade.entry_price + priceStep * i + noise;

      const open = currentPrice;
      const close = nextPrice;
      const high = Math.max(open, close) + Math.random() * volatility * 0.1;
      const low = Math.min(open, close) - Math.random() * volatility * 0.1;

      ticks.push({
        time: Math.floor(time / 1000),
        price: parseFloat(currentPrice.toFixed(2)),
        volume: Math.floor(Math.random() * 1000) + 100,
      });

      currentPrice = nextPrice;
    }

    return ticks;
  };

  const fetchMarketDataTicks = async (trade: Trade): Promise<TickData[] | null> => {
    if (!user) return null;
    try {
      const entry = new Date(trade.entry_date).getTime();
      const exit = trade.exit_date ? new Date(trade.exit_date).getTime() : entry + 3600000;
      const padding = 60 * 60 * 1000;

      const from = new Date(entry - padding).toISOString();
      const to = new Date(exit + padding).toISOString();

      const { data, error } = await supabase.functions.invoke('fetch-market-data', {
        body: {
          symbol: trade.symbol,
          from,
          to,
          timeframe: '1m',
        },
      });

      if (error) {
        console.error('Error invoking market data function:', error);
        return null;
      }

      if (!data || !Array.isArray((data as any).data)) {
        return null;
      }

      const bars = (data as { data: Array<{ time: string; close: number; volume?: number }> }).data;

      const ticks = bars
        .map((bar) => {
          const time = new Date(bar.time).getTime();
          if (!Number.isFinite(time) || Number.isNaN(time)) {
            return null;
          }

          return {
            time: Math.floor(time / 1000),
            price: Number.isFinite(bar.close) ? Number(bar.close) : trade.entry_price,
            volume: Number.isFinite(bar.volume ?? 0) ? Number(bar.volume ?? 0) : 0,
          } satisfies TickData;
        })
        .filter((tick): tick is TickData => Boolean(tick));

      return ticks.length > 0 ? ticks : null;
    } catch (err) {
      console.error('Failed to fetch real market data:', err);
      return null;
    }
  };

  const selectTrade = async (trade: Trade) => {
    if (!user) return;
    setSelectedTrade(trade);
    setCurrentTick(0);
    setIsPlaying(false);
    setInsights('');
    setLoading(true);

    try {
      const { data: replayData, error } = await supabase
        .from('trade_replays')
        .select('*')
        .eq('trade_id', trade.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      let ticks: TickData[] = [];
      let aiInsights = replayData?.replay_insights || '';
      let source: 'provider' | 'synthetic' = (replayData?.data_source as 'provider' | 'synthetic') || 'synthetic';

      if (replayData?.tick_data?.length) {
        ticks = replayData.tick_data as TickData[];
        await supabase
          .from('trade_replays')
          .update({ times_viewed: (replayData.times_viewed || 0) + 1 })
          .eq('id', replayData.id);
      }

      if (ticks.length === 0 || source === 'synthetic') {
        const marketResult = await fetchMarketTicks(trade);
        if (marketResult.ticks.length) {
          ticks = marketResult.ticks;
          source = marketResult.source;
        }
      }

      if (ticks.length === 0) {
        ticks = generateSyntheticTickData(trade);
        source = 'synthetic';
      }

      if (!aiInsights) {
        aiInsights = generateInsights(trade, ticks);
      }

      if (replayData) {
        await supabase
          .from('trade_replays')
          .update({
            tick_data: ticks,
            replay_insights: aiInsights,
            data_source: source === 'provider' ? 'provider' : 'synthetic',
            times_viewed: (replayData.times_viewed || 0) + 1,
          })
          .eq('id', replayData.id);
      } else {
        await supabase.from('trade_replays').insert({
          trade_id: trade.id,
          user_id: user!.id,
          tick_data: ticks,
          replay_insights: aiInsights,
          times_viewed: 1,
          data_source: source === 'provider' ? 'provider' : 'synthetic',
        });
      }

      setTickData(ticks);
      setDataSource(source);
      setInsights(aiInsights);

      if (!trade.replay_reviewed) {
        const { error: updateError } = await supabase
          .from('trades')
          .update({ replay_reviewed: true })
          .eq('id', trade.id);

        setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, replay_reviewed: true } : t));
        setSelectedTrade(prev => prev ? { ...prev, replay_reviewed: true } : prev);

        if (badgeTimeoutRef.current) {
          clearTimeout(badgeTimeoutRef.current);
        }

        badgeTimeoutRef.current = setTimeout(() => {
          checkReplayBadge().catch((err) => {
            console.error('Badge check failed:', err);
          });
          awardReplayXP(trade).catch((err) => {
            console.error('Failed to award replay XP:', err);
          });
        }, 300);
      }
    } catch (err) {
      console.error('Error loading replay:', err);
      const fallbackTicks = generateSyntheticTickData(trade);
      setTickData(fallbackTicks);
      setInsights(generateInsights(trade, fallbackTicks));
      setDataSource('synthetic');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (trade: Trade, ticks: TickData[]): string => {
    if (ticks.length === 0) {
      return 'Replay data unavailable for this trade. Try fetching market data again soon.';
    }

    const leadingTicks = ticks.slice(0, Math.max(1, Math.floor(ticks.length * 0.2)));
    const optimalEntryPrice = Math.min(...leadingTicks.map(t => t.price));
    const entryDiff = Math.abs(trade.entry_price - optimalEntryPrice);
    const pnlPercent = ((trade.pnl / (trade.entry_price * trade.quantity)) * 100).toFixed(2);

    let insightsText = `Trade Performance: ${trade.pnl >= 0 ? 'Profit' : 'Loss'} of $${Math.abs(trade.pnl).toFixed(2)} (${pnlPercent}%)\n\n`;

    const optimalEntryPrice = Math.min(...ticks.slice(0, Math.max(1, Math.floor(ticks.length * 0.2))).map(t => t.price));
    const entryDiff = Math.abs(trade.entry_price - optimalEntryPrice);

    if (entryDiff > trade.entry_price * 0.001) {
      insightsText += `⚠️ Entry Timing: Missed optimal entry by ${entryDiff.toFixed(2)} points. Could have entered at ${optimalEntryPrice.toFixed(2)} instead of ${trade.entry_price.toFixed(2)}.\n\n`;
    } else {
      insightsText += '✅ Entry Timing: Good entry near optimal price.\n\n';
    }

    const prices = ticks.map(t => t.price);
    const maxAdverse = trade.trade_type === 'long' ? Math.min(...prices) : Math.max(...prices);
    const maxFavorable = trade.trade_type === 'long' ? Math.max(...prices) : Math.min(...prices);

    insightsText += `📊 Max Adverse: ${maxAdverse.toFixed(2)} | Max Favorable: ${maxFavorable.toFixed(2)}\n\n`;

    if (trade.pnl < 0 && trade.exit_price) {
      insightsText += '💡 Tip: Consider using a stop loss. This trade moved against you significantly.\n';
    }

    return insightsText;
  };

  const buildCandleData = (ticks: TickData[]): CandlestickData[] => {
    if (ticks.length === 0) return [];

    return ticks.map((tick, idx) => {
      const nextTick = ticks[idx + 1] || tick;
      const high = Math.max(tick.price, nextTick.price);
      const low = Math.min(tick.price, nextTick.price);

      return {
        time: tick.time,
        open: tick.price,
        high: high + Math.random() * 0.1,
        low: low - Math.random() * 0.1,
        close: nextTick.price,
      } satisfies CandlestickData;
    });
  };

  const checkReplayBadge = async () => {
    if (!user) return;

    const { count, error } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('replay_reviewed', true);

    if (error) throw error;

    if ((count ?? 0) >= 5) {
      const { data: gamificationRow, error: fetchError } = await supabase
        .from('gamification')
        .select('badges, achievements')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const badges = Array.isArray(gamificationRow?.badges) ? [...gamificationRow.badges] : [];
      if (!badges.some(badge => badge?.id === 'replay_master')) {
        badges.push({ id: 'replay_master', earned_at: new Date().toISOString(), reviewed_count: count ?? 0 });

        const { error: updateError } = await supabase
          .from('gamification')
          .upsert({
            user_id: user.id,
            badges,
            achievements: gamificationRow?.achievements ?? [],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (updateError) {
          throw updateError;
        }
      }
    }
  };

  const awardReplayXP = async (trade: Trade) => {
    if (!user) return;

    try {
      const { error: eventError } = await supabase
        .from('gamification_events')
        .insert({
          user_id: user.id,
          event_type: 'replay_review',
          xp_awarded: 10,
          metadata: { trade_id: trade.id },
        });

      if (eventError) {
        console.warn('Unable to log gamification event:', eventError.message);
      }
    } catch (eventInsertError) {
      console.warn('Gamification events logging unavailable:', eventInsertError);
    }

    const { data: gamificationRow, error } = await supabase
      .from('gamification')
      .select('total_xp, current_level')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const totalXP = (gamificationRow?.total_xp ?? 0) + 10;
    const currentLevel = Math.floor(totalXP / 1000) + 1;

    if (gamificationRow) {
      const { error: updateError } = await supabase
        .from('gamification')
        .update({
          total_xp: totalXP,
          current_level: currentLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from('gamification')
        .insert({
          user_id: user.id,
          total_xp: totalXP,
          current_level: currentLevel,
        });

      if (insertError) {
        throw insertError;
      }
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(prev => {
      if (prev && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return !prev;
    });
  };

  const resetReplay = () => {
    setCurrentTick(0);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!selectedTrade) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      return;
    }

    if (!chartContainerRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width && chartContainerRef.current) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [selectedTrade]);

  useEffect(() => {
    if (!selectedTrade || !seriesRef.current || tickData.length === 0) {
      return;
    }

    const candles = buildCandleData(tickData);
    candleDataRef.current = candles;

    const entryMarker: SeriesMarker<'Candlestick'> = {
      time: tickData[0].time,
      position: selectedTrade.trade_type === 'long' ? 'belowBar' : 'aboveBar',
      color: '#3b82f6',
      shape: 'arrowUp',
      text: `Entry: $${selectedTrade.entry_price.toFixed(2)}`,
    };

    const exitTick = tickData[tickData.length - 1];

    const exitMarker: SeriesMarker<'Candlestick'> | null = selectedTrade.exit_price
      ? {
          time: exitTick.time,
          position: selectedTrade.trade_type === 'long' ? 'aboveBar' : 'belowBar',
          color: selectedTrade.pnl >= 0 ? '#10b981' : '#ef4444',
          shape: 'arrowDown',
          text: `Exit: $${selectedTrade.exit_price.toFixed(2)}`,
        }
      : null;

    const markers = exitMarker ? [entryMarker, exitMarker] : [entryMarker];

    seriesRef.current.setMarkers(markers);
    seriesRef.current.setData(candles.slice(0, currentTick + 1));
    chartRef.current?.timeScale().fitContent();
  }, [tickData, selectedTrade]);

  useEffect(() => {
    if (!seriesRef.current || candleDataRef.current.length === 0) return;

    const visibleData = candleDataRef.current.slice(0, currentTick + 1);
    seriesRef.current.setData(visibleData.length > 0 ? visibleData : []);
  }, [currentTick]);

  useEffect(() => {
    if (!isPlaying) {
      return;
  const checkReplayBadge = async () => {
    try {
      const { count, error } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('replay_reviewed', true);

      if (error) {
        console.error('Failed to count reviewed replays:', error);
        return;
      }

      if ((count ?? 0) >= 10) {
        const { data: gamData } = await supabase
          .from('gamification')
          .select('badges')
          .eq('user_id', user!.id)
          .maybeSingle();

        const badges = Array.isArray(gamData?.badges) ? [...(gamData?.badges as any[])] : [];
        const alreadyEarned = badges.some((badge: any) => badge?.id === 'replay_novice');

        if (!alreadyEarned) {
          badges.push({ id: 'replay_novice', earned_at: new Date().toISOString(), reviewed_count: count });
          const { error: badgeError } = await supabase
            .from('gamification')
            .upsert(
              {
                user_id: user!.id,
                badges,
              },
              { onConflict: 'user_id' }
            );

          if (badgeError) {
            console.error('Failed to upsert replay badge:', badgeError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check replay badge:', error);
    }

    const playbackInterval = setInterval(() => {
      setCurrentTick(prev => {
        if (prev >= tickData.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, Math.max(50, 200 / speed));

    intervalRef.current = playbackInterval;

    return () => {
      clearInterval(playbackInterval);
      if (intervalRef.current === playbackInterval) {
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, tickData.length]);

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const resetReplay = () => {
    stopPlayback();
    setCurrentTick(0);
    updateVisibleSeries(0);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!selectedTrade) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Replay</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-300">
            Select a closed trade below to replay it tick-by-tick and review your execution.
          </p>
        </div>

        <div className="grid gap-4">
          {trades.map(trade => {
            const duration = trade.exit_date
              ? new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime()
              : 0;

            return (
              <button
                key={trade.id}
                onClick={() => selectTrade(trade)}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{trade.symbol}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.trade_type === 'long'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        }`}
                      >
                        {trade.trade_type.toUpperCase()}
                      </span>
                      {trade.replay_reviewed && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Reviewed</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{new Date(trade.entry_date).toLocaleDateString()}</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(duration)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xl font-bold ${
                        trade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${trade.entry_price.toFixed(2)} → ${trade.exit_price?.toFixed(2)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSelectedTrade(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
              <span>{selectedTrade.symbol}</span>
              <span
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  selectedTrade.trade_type === 'long'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                }`}
              >
                {selectedTrade.trade_type.toUpperCase()}
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {new Date(selectedTrade.entry_date).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Data source: {dataSource === 'provider' ? 'Live market data' : 'Synthetic playback'}
            </p>
          </div>
        </div>
        <div
          className={`text-3xl font-bold ${
            selectedTrade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading replay data...</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div ref={chartContainerRef} className="w-full" />

            <div className="mt-4 flex items-center justify-center space-x-4">
              <button
                onClick={resetReplay}
                className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlayPause}
                className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <select
                  value={speed}
                  onChange={event => setSpeed(Number(event.target.value))}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Tick {Math.min(currentTick + 1, tickData.length)} / {tickData.length}
              </div>
            </div>
          </div>

          {insights && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>AI Replay Insights</span>
              </h3>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono text-sm">
                {insights}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Entry Price</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${selectedTrade.entry_price.toFixed(2)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Exit Price</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${selectedTrade.exit_price?.toFixed(2)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Quantity</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {selectedTrade.quantity}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">P&amp;L</div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  selectedTrade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {tickData[currentTick] && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Time &amp; Sales</h3>
              <div className="space-y-1 font-mono text-sm">
                {tickData
                  .slice(Math.max(0, currentTick - 5), currentTick + 1)
                  .reverse()
                  .map((tick, idx) => (
                    <div key={`${tick.time}-${idx}`} className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>{new Date(tick.time * 1000).toLocaleTimeString()}</span>
                      <span className={idx === 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}>
                        ${tick.price.toFixed(2)}
                      </span>
                      <span className="text-gray-500">{tick.volume}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
