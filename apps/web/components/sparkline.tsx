interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  color = "#888",
  width = 100,
  height = 32,
  fill = false,
  strokeWidth = 1.5,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth={1}
          opacity={0.3}
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const chartHeight = height - padding * 2;
  const chartWidth = width;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const linePath = `M${points.join("L")}`;
  const fillPath = `${linePath}L${chartWidth},${height}L0,${height}Z`;

  const gradientId = `sparkline-gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {fill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
      )}
      {fill && (
        <path d={fillPath} fill={`url(#${gradientId})`} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
