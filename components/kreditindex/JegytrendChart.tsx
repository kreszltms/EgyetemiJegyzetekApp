"use client";

// ============================================================================
// EGYETEMI JEGYZETEK — Jegytrend grafikon
// Egyszerű, egyetlen sorozatos (single-series) vonaldiagram: hogyan alakult
// a kredit-súlyozott féléves átlag időben. Egy sorozat → nincs szükség
// jelmagyarázatra (a cím/alcím már megnevezi, mit ábrázolunk); a pontok
// natív <title> tooltippel súgják az értéket, a vonal az app semleges
// "primary" tokenjét használja (currentColor), a tengelyek/rácsvonalak a
// halványabb szöveg-tokeneket — a szín sosem a szöveget viseli.
// ============================================================================

export interface JegytrendPoint {
  /** Rövid, x-tengelyre kerülő címke — jellemzően a félév neve. */
  label: string;
  /** Kredit-súlyozott átlag (1-5 skálán). */
  value: number;
}

const Y_MIN = 1;
const Y_MAX = 5;
const STEP_WIDTH = 88;
const PAD_LEFT = 26;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 30;
const INNER_HEIGHT = 130;

export function JegytrendChart({ data }: { data: JegytrendPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Legalább két félévnyi beszámítható átlag kell a trendvonalhoz — még nincs
        elég adat.
      </p>
    );
  }

  const width = PAD_LEFT + PAD_RIGHT + STEP_WIDTH * (data.length - 1);
  const height = PAD_TOP + INNER_HEIGHT + PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + i * STEP_WIDTH;
  const yFor = (value: number) => {
    const clamped = Math.min(Y_MAX, Math.max(Y_MIN, value));
    return PAD_TOP + INNER_HEIGHT * (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN));
  };

  const linePoints = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(" ");
  const last = data[data.length - 1];
  const summary = data.map((d) => `${d.label}: ${d.value.toFixed(2)}`).join(", ");

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label={`Félévenkénti súlyozott átlag alakulása — ${summary}`}
        width={Math.max(width, 260)}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Rácsvonalak (1-5) — halvány, hajszálvékony, sosem szaggatott */}
        <g className="text-border" stroke="currentColor" strokeWidth={1}>
          {[1, 2, 3, 4, 5].map((g) => (
            <line
              key={g}
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={yFor(g)}
              y2={yFor(g)}
            />
          ))}
        </g>
        <g className="text-muted-foreground" fill="currentColor" fontSize={10}>
          {[1, 2, 3, 4, 5].map((g) => (
            <text key={g} x={PAD_LEFT - 6} y={yFor(g)} textAnchor="end" dy="0.32em">
              {g}
            </text>
          ))}
        </g>

        {/* A vonal maga */}
        <polyline
          points={linePoints}
          fill="none"
          className="text-primary"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Pontok — kártya-hátterű gyűrűvel, hogy a vonalon is elváljanak */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(d.value)}
            r={4}
            className="text-primary"
            fill="currentColor"
            stroke="var(--card)"
            strokeWidth={2}
          >
            <title>{`${d.label}: ${d.value.toFixed(2)}`}</title>
          </circle>
        ))}

        {/* Az utolsó (legfrissebb) pont értéke közvetlenül kiírva */}
        <text
          x={xFor(data.length - 1)}
          y={yFor(last.value) - 10}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          className="text-foreground"
          fill="currentColor"
        >
          {last.value.toFixed(2)}
        </text>

        {/* Félévnevek az x-tengelyen */}
        <g className="text-muted-foreground" fill="currentColor" fontSize={10}>
          {data.map((d, i) => (
            <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle">
              {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
