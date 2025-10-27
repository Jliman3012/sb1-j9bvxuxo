import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Play, Pause, RotateCcw, ChevronLeft, Gauge, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

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
}

interface TickData {
  time: number;
  price: number;
  volume: number;
}

interface TradeReplayProps {
  onBack: () => void;
}

export default function TradeReplay({ onBack }: TradeReplayProps) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tickData, setTickData] = useState<TickData[]>([]);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTrades();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (chartRef.current) chartRef.current.remove();
    };
  }, []);

  const loadTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .not('exit_date', 'is', null)
        .order('entry_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrades(data || []);
    } catch (err) {
      console.error('Error loading trades:', err);
    }
  };

  const generateSyntheticTickData = (trade: Trade): TickData[] => {
    const entryTime = new Date(trade.entry_date).getTime();
    const exitTime = trade.exit_date ? new Date(trade.exit_date).getTime() : entryTime + 3600000;
    const duration = exitTime - entryTime;
    const numTicks = Math.min(Math.max(Math.floor(duration / 1000), 50), 500);

    const ticks: TickData[] = [];
    const priceRange = Math.abs((trade.exit_price || trade.entry_price) - trade.entry_price);
    const volatility = priceRange * 0.3;

    let currentPrice = trade.entry_price;
    const priceStep = ((trade.exit_price || trade.entry_price) - trade.entry_price) / numTicks;

    for (let i = 0; i <= numTicks; i++) {
      const time = entryTime + (duration * i / numTicks);
      const noise = (Math.random() - 0.5) * volatility * 0.3;
      currentPrice = trade.entry_price + (priceStep * i) + noise;

      ticks.push({
        time: Math.floor(time / 1000),
        price: parseFloat(currentPrice.toFixed(2)),
        volume: Math.floor(Math.random() * 1000) + 100
      });
    }

    return ticks;
  };

  const selectTrade = async (trade: Trade) => {
    setSelectedTrade(trade);
    setCurrentTick(0);
    setIsPlaying(false);
    setLoading(true);

    try {
      const { data: replayData } = await supabase
        .from('trade_replays')
        .select('*')
        .eq('trade_id', trade.id)
        .maybeSingle();

      let ticks: TickData[];
      let aiInsights = '';

      if (replayData && replayData.tick_data) {
        ticks = replayData.tick_data as TickData[];
        aiInsights = replayData.replay_insights || '';

        await supabase
          .from('trade_replays')
          .update({ times_viewed: (replayData.times_viewed || 0) + 1 })
          .eq('id', replayData.id);
      } else {
        ticks = generateSyntheticTickData(trade);
        aiInsights = generateInsights(trade, ticks);

        await supabase.from('trade_replays').insert({
          trade_id: trade.id,
          user_id: user!.id,
          tick_data: ticks,
          replay_insights: aiInsights,
          times_viewed: 1
        });
      }

      setTickData(ticks);
      setInsights(aiInsights);
      initializeChart(ticks, trade);

      if (!trade.replay_reviewed) {
        await supabase
          .from('trades')
          .update({ replay_reviewed: true })
          .eq('id', trade.id);

        await checkReplayBadge();
      }
    } catch (err) {
      console.error('Error loading replay:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (trade: Trade, ticks: TickData[]): string => {
    const entryIndex = 0;
    const exitIndex = ticks.length - 1;
    const optimalEntryPrice = Math.min(...ticks.slice(0, Math.floor(ticks.length * 0.2)).map(t => t.price));
    const entryDiff = Math.abs(trade.entry_price - optimalEntryPrice);
    const pnlPercent = ((trade.pnl / (trade.entry_price * trade.quantity)) * 100).toFixed(2);

    let insights = `Trade Performance: ${trade.pnl >= 0 ? 'Profit' : 'Loss'} of $${Math.abs(trade.pnl).toFixed(2)} (${pnlPercent}%)\n\n`;

    if (entryDiff > trade.entry_price * 0.001) {
      insights += `⚠️ Entry Timing: Missed optimal entry by ${entryDiff.toFixed(2)} points. `;
      insights += `Could have entered at ${optimalEntryPrice.toFixed(2)} instead of ${trade.entry_price.toFixed(2)}.\n\n`;
    } else {
      insights += `✅ Entry Timing: Good entry near optimal price.\n\n`;
    }

    const maxAdverse = trade.trade_type === 'long'
      ? Math.min(...ticks.map(t => t.price))
      : Math.max(...ticks.map(t => t.price));
    const maxFavorable = trade.trade_type === 'long'
      ? Math.max(...ticks.map(t => t.price))
      : Math.min(...ticks.map(t => t.price));

    insights += `📊 Max Adverse: ${maxAdverse.toFixed(2)} | Max Favorable: ${maxFavorable.toFixed(2)}\n\n`;

    if (trade.pnl < 0 && trade.exit_price) {
      insights += `💡 Tip: Consider using a stop loss. This trade moved against you significantly.\n`;
    }

    return insights;
  };

  const initializeChart = (ticks: TickData[], trade: Trade) => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
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

    const candleData = ticks.map((tick, idx) => {
      const nextTick = ticks[idx + 1] || tick;
      return {
        time: tick.time,
        open: tick.price,
        high: Math.max(tick.price, nextTick.price) + Math.random() * 0.5,
        low: Math.min(tick.price, nextTick.price) - Math.random() * 0.5,
        close: nextTick.price,
      };
    });

    candlestickSeries.setData(candleData);

    const entryMarker = {
      time: ticks[0].time,
      position: trade.trade_type === 'long' ? 'belowBar' : 'aboveBar' as const,
      color: '#3b82f6',
      shape: 'arrowUp' as const,
      text: `Entry: $${trade.entry_price.toFixed(2)}`,
    };

    const exitMarker = trade.exit_price ? {
      time: ticks[ticks.length - 1].time,
      position: trade.trade_type === 'long' ? 'aboveBar' : 'belowBar' as const,
      color: trade.pnl >= 0 ? '#10b981' : '#ef4444',
      shape: 'arrowDown' as const,
      text: `Exit: $${trade.exit_price.toFixed(2)}`,
    } : null;

    const markers = exitMarker ? [entryMarker, exitMarker] : [entryMarker];
    candlestickSeries.setMarkers(markers);

    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
  };

  const checkReplayBadge = async () => {
    const { data: reviewedCount } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('replay_reviewed', true);

    if (reviewedCount && reviewedCount >= 5) {
      await supabase.from('gamification').upsert({
        user_id: user!.id,
        achievement: 'replay_master',
        achievement_data: { reviewed_count: reviewedCount }
      }, { onConflict: 'user_id,achievement' });
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      intervalRef.current = setInterval(() => {
        setCurrentTick(prev => {
          if (prev >= tickData.length - 1) {
            setIsPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 100 / speed);
    }
  };

  const resetReplay = () => {
    setCurrentTick(0);
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    if (chartRef.current && seriesRef.current && tickData.length > 0) {
      const visibleData = tickData.slice(0, currentTick + 1).map((tick, idx) => {
        const nextTick = tickData[idx + 1] || tick;
        return {
          time: tick.time,
          open: tick.price,
          high: Math.max(tick.price, nextTick.price) + Math.random() * 0.5,
          low: Math.min(tick.price, nextTick.price) - Math.random() * 0.5,
          close: nextTick.price,
        };
      });
      seriesRef.current.setData(visibleData);
    }
  }, [currentTick, tickData]);

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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.trade_type === 'long'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}>
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
                    <div className={`text-xl font-bold ${
                      trade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
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
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                selectedTrade.trade_type === 'long'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
              }`}>
                {selectedTrade.trade_type.toUpperCase()}
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {new Date(selectedTrade.entry_date).toLocaleString()}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold ${
          selectedTrade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
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
                  onChange={(e) => setSpeed(Number(e.target.value))}
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
                Tick {currentTick + 1} / {tickData.length}
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
              <div className="text-sm text-gray-600 dark:text-gray-400">P&L</div>
              <div className={`text-2xl font-bold mt-1 ${
                selectedTrade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {tickData[currentTick] && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Time & Sales</h3>
              <div className="space-y-1 font-mono text-sm">
                {tickData.slice(Math.max(0, currentTick - 5), currentTick + 1).reverse().map((tick, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700 dark:text-gray-300">
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
