'use client';

// Sparkline — small inline SVG line chart. No external chart lib needed.
// Used inside stat cards and tables for instant trend visualization.

export function Sparkline({
  data, width = 80, height = 24, color = '#f59e0b', fill = true, strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} aria-hidden={true} />;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const gid = `spark-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden={true} className="overflow-visible">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gid})`} stroke="none" />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sofia-spark-path"
      />
      {data.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={strokeWidth + 0.8}
          fill={color}
          className="sofia-spark"
        />
      )}
    </svg>
  );
}

// Vertical bar sparkline for daily-activity heatmaps.
export function BarSparkline({
  data, width = 80, height = 24, color = '#10b981',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length === 0) return <svg width={width} height={height} aria-hidden={true} />;
  const max = Math.max(...data, 1);
  const gap = 1;
  const barW = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden={true}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 1);
        const x = i * (barW + gap);
        const y = height - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} rx={0.5} fill={color} opacity={0.4 + (v / max) * 0.6} />;
      })}
    </svg>
  );
}
