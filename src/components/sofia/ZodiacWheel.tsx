'use client';

// ZodiacWheel — decorative SVG ring of 12 zodiac glyphs. Lights up segments
// when users of that sign exist (passed as a sign->count map).

import { ZODIAC } from './zodiac-data';

export function ZodiacWheel({
  counts, size = 220,
}: {
  counts: Record<string, number>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 8;
  const rInner = rOuter - 28;
  const rGlyph = rOuter - 14;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const segAngle = 360 / 12;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <defs>
        <radialGradient id="zw-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
          <stop offset="60%" stopColor="#b45309" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="zw-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* outer glow */}
      <circle cx={cx} cy={cy} r={rOuter} fill="url(#zw-glow)" />

      {/* segments */}
      {ZODIAC.map((z, i) => {
        const a0 = (i * segAngle - 90) * (Math.PI / 180);
        const a1 = ((i + 1) * segAngle - 90) * (Math.PI / 180);
        const x0o = cx + rOuter * Math.cos(a0);
        const y0o = cy + rOuter * Math.sin(a0);
        const x1o = cx + rOuter * Math.cos(a1);
        const y1o = cy + rOuter * Math.sin(a1);
        const x0i = cx + rInner * Math.cos(a0);
        const y0i = cy + rInner * Math.sin(a0);
        const x1i = cx + rInner * Math.cos(a1);
        const y1i = cy + rInner * Math.sin(a1);
        const count = counts[z.name] ?? 0;
        const has = count > 0;
        const fill = has ? `rgba(245, 158, 11, ${0.18 + Math.min(0.55, (count / total) * 1.4)})` : 'rgba(68, 64, 60, 0.3)';
        const path = `M${x0o},${y0o} A${rOuter},${rOuter} 0 0 1 ${x1o},${y1o} L${x1i},${y1i} A${rInner},${rInner} 0 0 0 ${x0i},${y0i} Z`;
        // glyph position at the middle of the segment, slightly inside.
        const aMid = ((i + 0.5) * segAngle - 90) * (Math.PI / 180);
        const gx = cx + rGlyph * Math.cos(aMid);
        const gy = cy + rGlyph * Math.sin(aMid);
        return (
          <g key={z.name}>
            <path
              d={path}
              fill={fill}
              stroke="rgba(180, 83, 9, 0.4)"
              strokeWidth={0.8}
              className="transition-all duration-500"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            <text
              x={gx}
              y={gy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fill={has ? '#fde68a' : '#a8a29e'}
              opacity={has ? 1 : 0.5}
              className="select-none"
            >
              {z.emoji}
            </text>
            {count > 0 && (
              <text
                x={cx + (rGlyph - 18) * Math.cos(aMid)}
                y={cy + (rGlyph - 18) * Math.sin(aMid)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8"
                fill="#fbbf24"
                opacity={0.7}
                className="select-none font-mono"
              >
                {count}
              </text>
            )}
          </g>
        );
      })}

      {/* central seal */}
      <circle cx={cx} cy={cy} r={rInner - 6} fill="url(#zw-center)" opacity={0.7} className="sofia-glow" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" className="select-none">🔮</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#fef3c7" className="select-none font-serif" fontStyle="italic">Sofia</text>
    </svg>
  );
}
