interface EquityChartProps {
  trades: any[];
  initialCapital: number;
}

export default function EquityChart({ trades, initialCapital }: EquityChartProps) {
  if (!trades || trades.length === 0) {
    return null;
  }

  let runningCapital = initialCapital;
  const equityPoints = [{ x: 0, y: initialCapital }];

  trades.forEach((trade, index) => {
    runningCapital += trade.pnl || 0;
    equityPoints.push({ x: index + 1, y: runningCapital });
  });

  const maxY = Math.max(...equityPoints.map(p => p.y));
  const minY = Math.min(...equityPoints.map(p => p.y));
  const rangeY = maxY - minY;
  const paddingY = rangeY * 0.1;

  const chartHeight = 300;
  const chartWidth = 800;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const scaleX = (x: number) => paddingLeft + (x / trades.length) * innerWidth;
  const scaleY = (y: number) => {
    const adjustedMax = maxY + paddingY;
    const adjustedMin = minY - paddingY;
    const adjustedRange = adjustedMax - adjustedMin;
    return chartHeight - paddingBottom - ((y - adjustedMin) / adjustedRange) * innerHeight;
  };

  const pathData = equityPoints
    .map((point, index) => {
      const x = scaleX(point.x);
      const y = scaleY(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const isProfit = runningCapital >= initialCapital;
  const lineColor = isProfit ? '#10b981' : '#ef4444';

  const yAxisTicks = 5;
  const yAxisValues = Array.from({ length: yAxisTicks }, (_, i) => {
    const adjustedMax = maxY + paddingY;
    const adjustedMin = minY - paddingY;
    return adjustedMin + ((adjustedMax - adjustedMin) / (yAxisTicks - 1)) * i;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity Curve</h3>
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
          <defs>
            <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {yAxisValues.map((value, i) => {
            const y = scaleY(value);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#6b7280"
                >
                  ${value.toFixed(0)}
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            y1={scaleY(initialCapital)}
            x2={chartWidth - paddingRight}
            y2={scaleY(initialCapital)}
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          <path
            d={`${pathData} L ${scaleX(trades.length)} ${chartHeight - paddingBottom} L ${paddingLeft} ${chartHeight - paddingBottom} Z`}
            fill="url(#equityGradient)"
          />

          <path
            d={pathData}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {equityPoints.map((point, index) => (
            <circle
              key={index}
              cx={scaleX(point.x)}
              cy={scaleY(point.y)}
              r="4"
              fill={point.y >= initialCapital ? '#10b981' : '#ef4444'}
              className="hover:r-6 transition-all cursor-pointer"
            >
              <title>
                Trade {point.x}: ${point.y.toFixed(2)}
              </title>
            </circle>
          ))}

          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            stroke="#374151"
            strokeWidth="2"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={chartHeight - paddingBottom}
            stroke="#374151"
            strokeWidth="2"
          />

          <text
            x={chartWidth / 2}
            y={chartHeight - 5}
            textAnchor="middle"
            fontSize="14"
            fill="#374151"
            fontWeight="500"
          >
            Trade Number
          </text>
          <text
            x={20}
            y={chartHeight / 2}
            textAnchor="middle"
            fontSize="14"
            fill="#374151"
            fontWeight="500"
            transform={`rotate(-90, 20, ${chartHeight / 2})`}
          >
            Portfolio Value ($)
          </text>
        </svg>
      </div>
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-gray-400" style={{ borderTop: '2px dashed #9ca3af' }}></div>
          <span className="text-gray-600">Initial Capital</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: lineColor }}></div>
          <span className="text-gray-600">Equity Curve</span>
        </div>
      </div>
    </div>
  );
}
