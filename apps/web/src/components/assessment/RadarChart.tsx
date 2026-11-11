// Bieu do radar 11 phuong dien — ve bang SVG thuan, khong them lib.
// scores: diem 1–5 theo tung phuong dien. previous (tuy chon): lan
// danh gia truoc de ve duong so sanh.
'use client';

import { DIMENSIONS, radarPoints, type Scores } from '@/lib/assessment-11d';

const SIZE = 400;
const CENTER = SIZE / 2;
const MAX_R = 120;

function ringPoints(radius: number): string {
  return DIMENSIONS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    return `${(CENTER + radius * Math.cos(angle)).toFixed(1)},${(CENTER + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

function labelPos(i: number): { x: number; y: number; anchor: 'middle' | 'start' | 'end' } {
  const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
  const r = MAX_R + 22;
  const x = CENTER + r * Math.cos(angle);
  const y = CENTER + r * Math.sin(angle);
  // Hai nhan gan day (06 The chat / 07 Tinh than) nam sat nhau: neo
  // ra hai phia de khong chong len nhau (thay vi cung can giua).
  if (Math.sin(angle) > 0.9) return { x, y, anchor: Math.cos(angle) > 0 ? 'start' : 'end' };
  const anchor = Math.abs(Math.cos(angle)) < 0.35 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
  return { x, y, anchor };
}

export default function RadarChart({
  scores,
  previous,
  title,
}: {
  scores: Scores;
  previous?: Scores | null;
  title?: string;
}) {
  const points = radarPoints(scores, SIZE, MAX_R);
  const polygon = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const prevPolygon = previous
    ? radarPoints(previous, SIZE, MAX_R)
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ')
    : null;

  return (
    <div className="assessment-radar" role="img" aria-label={title ?? 'Biểu đồ radar 11 phương diện'}>
      {/* viewBox co le -40/-15 de nhan ben trai/phai va tren/duoi khong bi cat. */}
      <svg viewBox="-40 -15 480 430" width="100%" height="auto" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((v) => (
          <polygon
            key={v}
            points={ringPoints((v / 5) * MAX_R)}
            fill="none"
            stroke="rgba(168, 132, 28, 0.35)"
            strokeWidth={v === 5 ? 1.5 : 1}
          />
        ))}
        {DIMENSIONS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + MAX_R * Math.cos(angle)}
              y2={CENTER + MAX_R * Math.sin(angle)}
              stroke="rgba(168, 132, 28, 0.25)"
              strokeWidth={1}
            />
          );
        })}
        {prevPolygon && (
          <polygon points={prevPolygon} fill="rgba(74, 66, 50, 0.08)" stroke="#4a4232" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
        <polygon points={polygon} fill="rgba(212, 175, 55, 0.25)" stroke="#a8841c" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#c9a227" stroke="#fff" strokeWidth={1.5} />
        ))}
        {DIMENSIONS.map((d, i) => {
          const pos = labelPos(i);
          return (
            <text
              key={d.key}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              dominantBaseline="middle"
              className="radar-label"
            >
              {d.num} {d.name}
            </text>
          );
        })}
      </svg>
      {previous && (
        <p className="radar-legend">
          <span className="radar-legend-now">— Lần này</span>{' '}
          <span className="radar-legend-prev">- - Lần trước</span>
        </p>
      )}
    </div>
  );
}
