import { useCallback, useEffect, useMemo, useState } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar as CalendarIcon, Loader2, Minus, Plus } from 'lucide-react';
import { supabase, Trade } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const TIMEZONE = 'Europe/Budapest';
const RANGE_OPTIONS = [6, 12, 18];

type DailyAggregate = {
  trade_day: string;
  gross_pnl: number;
  net_pnl: number;
  wins: number;
  losses: number;
  trade_count: number;
};

type FiltersState = {
  accountId: string | null;
  symbol: string | null;
  tag: string | null;
  session: string | null;
};

type AccountOption = {
  id: string;
  account_name: string;
};

type HeatmapValue = DailyAggregate & {
  date: string;
};

const defaultFilters: FiltersState = {
  accountId: null,
  symbol: null,
  tag: null,
  session: null,
};

function formatDateForRpc(date: Date) {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

function getTradeDay(trade: Trade) {
  const referenceDate = trade.exit_date ?? trade.entry_date;
  if (!referenceDate) {
    return null;
  }
  return formatInTimeZone(new Date(referenceDate), TIMEZONE, 'yyyy-MM-dd');
}

function applyTradeFilters(trade: Trade, filters: FiltersState) {
  if (filters.accountId && trade.account_id !== filters.accountId) {
    return false;
  }
  if (filters.symbol && trade.symbol !== filters.symbol) {
    return false;
  }
  if (filters.tag) {
    const tags = trade.tags ?? [];
    if (!tags.some(tag => tag === filters.tag)) {
      return false;
    }
  }
  if (filters.session) {
    const sessionValue = trade.journal_data?.session ?? trade.journal_data?.session_name ?? null;
    if (sessionValue !== filters.session) {
      return false;
    }
  }
  return true;
}

export default function TradeCalendar() {
  const { user } = useAuth();
  const [rangeMonths, setRangeMonths] = useState<number>(12);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [dailyData, setDailyData] = useState<DailyAggregate[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [symbolOptions, setSymbolOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [sessionOptions, setSessionOptions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'heatmap' | 'monthly'>('heatmap');
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toDate = useMemo(() => new Date(), []);
  const fromDate = useMemo(() => subMonths(toDate, rangeMonths - 1), [toDate, rangeMonths]);

  const accountMap = useMemo(() => {
    return accounts.reduce<Record<string, string>>((acc, account) => {
      acc[account.id] = account.account_name;
      return acc;
    }, {});
  }, [accounts]);

  const heatmapValues: HeatmapValue[] = useMemo(
    () =>
      dailyData.map((item) => ({
        ...item,
        date: item.trade_day,
      })),
    [dailyData],
  );

  const maxAbsNet = useMemo(() => {
    if (dailyData.length === 0) {
      return 0;
    }
    return Math.max(...dailyData.map((item) => Math.abs(Number(item.net_pnl))));
  }, [dailyData]);

  const dailyMap = useMemo(() => {
    const map = new Map<string, DailyAggregate>();
    for (const entry of dailyData) {
      map.set(entry.trade_day, entry);
    }
    return map;
  }, [dailyData]);

  const loadResources = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const [{ data: accountRows, error: accountError }, { data: tradeRows, error: tradeError }] = await Promise.all([
        supabase
          .from('broker_accounts')
          .select('id, account_name')
          .eq('user_id', user.id)
          .order('account_name'),
        supabase
          .from('trades')
          .select(
            `id, user_id, account_id, symbol, trade_type, entry_date, exit_date, entry_price, exit_price, quantity, pnl, fees, status, tags, journal_data`,
          )
          .eq('user_id', user.id),
      ]);

      if (accountError) {
        throw accountError;
      }
      if (tradeError) {
        throw tradeError;
      }

      const accountsData = (accountRows ?? []) as AccountOption[];
      const tradesData = (tradeRows ?? []) as Trade[];

      setAccounts(accountsData);
      setAllTrades(tradesData);

      const symbols = Array.from(new Set(tradesData.map((trade) => trade.symbol).filter(Boolean))) as string[];
      setSymbolOptions(symbols);

      const tagSet = new Set<string>();
      tradesData.forEach((trade) => {
        (trade.tags ?? []).forEach((tag) => {
          if (tag) {
            tagSet.add(tag);
          }
        });
      });
      setTagOptions(Array.from(tagSet));

      const sessionSet = new Set<string>();
      tradesData.forEach((trade) => {
        const sessionValue = trade.journal_data?.session ?? trade.journal_data?.session_name;
        if (sessionValue) {
          sessionSet.add(sessionValue);
        }
      });
      setSessionOptions(Array.from(sessionSet));
    } catch (resourceError) {
      console.error('Failed to load calendar resources', resourceError);
      setError('Unable to load calendar resources. Please try again later.');
    }
  }, [user]);

  const loadDailyData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_daily_pnl', {
        from_date: formatDateForRpc(fromDate),
        to_date: formatDateForRpc(toDate),
        account_ids: filters.accountId ? [filters.accountId] : null,
        symbols: filters.symbol ? [filters.symbol] : null,
        tags: filters.tag ? [filters.tag] : null,
        sessions: filters.session ? [filters.session] : null,
      });

      if (rpcError) {
        throw rpcError;
      }

      setDailyData((data ?? []) as DailyAggregate[]);
    } catch (rpcError) {
      console.error('Failed to load daily PnL data', rpcError);
      setError('Unable to load calendar data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters.accountId, filters.session, filters.symbol, filters.tag, fromDate, toDate, user]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    void loadDailyData();
  }, [loadDailyData]);

  const handleRangeChange = (months: number) => {
    setRangeMonths(months);
  };

  const classForValue = useCallback(
    (value: HeatmapValue | null) => {
      if (!value || Number.isNaN(value.net_pnl)) {
        return 'heatmap-empty';
      }
      if (value.net_pnl === 0 || maxAbsNet === 0) {
        return 'heatmap-neutral';
      }
      const intensity = Math.min(Math.abs(value.net_pnl) / maxAbsNet, 1);
      if (value.net_pnl > 0) {
        if (intensity > 0.66) return 'heatmap-positive-3';
        if (intensity > 0.33) return 'heatmap-positive-2';
        return 'heatmap-positive-1';
      }
      if (intensity > 0.66) return 'heatmap-negative-3';
      if (intensity > 0.33) return 'heatmap-negative-2';
      return 'heatmap-negative-1';
    },
    [maxAbsNet],
  );

  const weeksForMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push(days.slice(i, i + 7));
    }
    return chunks;
  }, [monthCursor]);

  const computeTradesForDate = useCallback(
    (date: Date) => {
      const key = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
      const tradesForDay = allTrades.filter((trade) => {
        const tradeDay = getTradeDay(trade);
        if (!tradeDay || tradeDay !== key) {
          return false;
        }
        return applyTradeFilters(trade, filters);
      });
      setSelectedTrades(tradesForDay);
    },
    [allTrades, filters],
  );

  const handleSelectDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      computeTradesForDate(date);
    },
    [computeTradesForDate],
  );

  useEffect(() => {
    if (selectedDate) {
      computeTradesForDate(selectedDate);
    }
  }, [allTrades, computeTradesForDate, filters, selectedDate]);

  const selectedKey = selectedDate ? formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd') : null;
  const selectedStats = selectedKey ? dailyMap.get(selectedKey) ?? null : null;

  const tooltipDataAttrs = useCallback(
    (value: HeatmapValue | null) => {
      if (!value) {
        return { 'data-tooltip': 'No trades' };
      }
      const tooltip = `Date: ${value.trade_day}\nNet P&L: ${Number(value.net_pnl).toFixed(2)}\nWins: ${value.wins} | Losses: ${value.losses}`;
      return {
        'data-tooltip': tooltip,
      };
    },
    [],
  );

  const legendEntries = [
    { className: 'heatmap-negative-3', label: 'Large loss' },
    { className: 'heatmap-negative-1', label: 'Small loss' },
    { className: 'heatmap-neutral', label: 'Flat' },
    { className: 'heatmap-positive-1', label: 'Small win' },
    { className: 'heatmap-positive-3', label: 'Large win' },
  ];

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-emerald-500" />
              Trade Calendar
            </h2>
            <p className="text-gray-500 dark:text-gray-400">Visualise daily performance and drill into wins or losses.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleRangeChange(option)}
                className={`px-3 py-1.5 rounded-lg border transition text-sm font-medium ${
                  rangeMonths === option
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : 'border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-600 dark:text-gray-300'
                }`}
              >
                Last {option} months
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account</label>
            <select
              value={filters.accountId ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  accountId: event.target.value === '' ? null : event.target.value,
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Instrument</label>
            <select
              value={filters.symbol ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  symbol: event.target.value === '' ? null : event.target.value,
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All instruments</option>
              {symbolOptions.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tag</label>
            <select
              value={filters.tag ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  tag: event.target.value === '' ? null : event.target.value,
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Session</label>
            <select
              value={filters.session ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  session: event.target.value === '' ? null : event.target.value,
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All sessions</option>
              {sessionOptions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === 'heatmap'
                ? 'bg-emerald-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            <CalendarIcon className="h-4 w-4" /> Heatmap
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === 'monthly'
                ? 'bg-emerald-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            <CalendarIcon className="h-4 w-4" /> Monthly grid
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-600 dark:text-gray-300"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            </div>
          ) : viewMode === 'heatmap' ? (
            <div className="space-y-4">
              <CalendarHeatmap
                startDate={fromDate}
                endDate={toDate}
                values={heatmapValues}
                classForValue={classForValue}
                tooltipDataAttrs={tooltipDataAttrs}
                onClick={(value: HeatmapValue | null) => {
                  if (value?.date) {
                    handleSelectDate(new Date(`${value.date}T00:00:00`));
                  }
                }}
                showWeekdayLabels
              />
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-600 dark:text-gray-300">Legend</span>
                {legendEntries.map((entry) => (
                  <span key={entry.className} className="flex items-center gap-2">
                    <span className={`h-3 w-6 rounded-sm ${entry.className}`} />
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonthCursor((prev) => subMonths(prev, 1))}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-600 dark:text-gray-300"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {format(monthCursor, 'MMMM yyyy')}
                </h3>
                <button
                  type="button"
                  onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-600 dark:text-gray-300"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <span key={label} className="text-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weeksForMonth.map((week, index) => (
                  <div key={index} className="contents">
                    {week.map((day) => {
                      const dayKey = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
                      const stats = dailyMap.get(dayKey);
                      const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                      const indicatorClass = stats
                        ? stats.net_pnl > 0
                          ? 'bg-emerald-500'
                          : stats.net_pnl < 0
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                        : 'bg-gray-300 dark:bg-gray-700';
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          disabled={!isCurrentMonth}
                          onClick={() => handleSelectDate(day)}
                          className={`flex h-20 flex-col items-center justify-between rounded-lg border p-2 transition ${
                            selectedKey === dayKey
                              ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/30'
                              : 'border-gray-200 bg-white hover:border-emerald-400 hover:shadow dark:border-gray-700 dark:bg-gray-900'
                          } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                        >
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {format(day, 'd')}
                          </span>
                          <span className={`h-3 w-3 rounded-full ${indicatorClass}`} />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {stats ? Number(stats.net_pnl).toFixed(0) : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                {selectedStats && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Net P&L: <span className={selectedStats.net_pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{Number(selectedStats.net_pnl).toFixed(2)}</span> · Wins: {selectedStats.wins} · Losses: {selectedStats.losses}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedTrades([]);
                }}
                className="rounded-full border border-gray-300 p-2 text-gray-500 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-600 dark:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              {selectedTrades.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                  No trades recorded for this day with the current filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTrades.map((trade) => {
                    const tradeDay = getTradeDay(trade);
                    const entryTime = trade.entry_date
                      ? formatInTimeZone(new Date(trade.entry_date), TIMEZONE, 'HH:mm')
                      : '—';
                    const exitTime = trade.exit_date
                      ? formatInTimeZone(new Date(trade.exit_date), TIMEZONE, 'HH:mm')
                      : '—';
                    return (
                      <div
                        key={trade.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {trade.symbol}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {tradeDay} · {entryTime} - {exitTime}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-lg font-semibold ${
                                trade.pnl >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {Number(trade.pnl).toFixed(2)}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">P&L</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
                          <div>
                            <p className="font-medium">Type</p>
                            <p className="uppercase">{trade.trade_type}</p>
                          </div>
                          <div>
                            <p className="font-medium">Quantity</p>
                            <p>{Number(trade.quantity).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="font-medium">Account</p>
                            <p>{accountMap[trade.account_id] ?? '—'}</p>
                          </div>
                          <div>
                            <p className="font-medium">Tags</p>
                            <p>{(trade.tags ?? []).join(', ') || '—'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
