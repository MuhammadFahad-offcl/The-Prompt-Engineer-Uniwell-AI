import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { InsightDay } from '../../types/api'
import { useT } from '../../lib/i18n'
import { chartColors } from '../../lib/theme'
import { cssVar } from '../../lib/motion'

// Single-series small multiples: one hue each, no legend needed (the title names the series),
// thin 2px lines, ≥8px markers, recessive grid, tooltip on hover, and a table view for every chart.
function palette(color: string) {
  const c = chartColors()
  return { ...c, line: color.startsWith('token:') ? cssVar(color.slice(6)) : c.series }
}

type Metric = 'mood' | 'workload' | 'energy'

function ChartTable({ days, render }: { days: InsightDay[]; render: (d: InsightDay) => string }) {
  const { t } = useT()
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer select-none">{t('ins.chartAlt')}</summary>
      <table className="mt-2 w-full text-left">
        <tbody>
          {days.map((d) => (
            <tr key={d.local_date} className="border-t border-line">
              <th scope="row" className="py-1 pr-2 font-medium">
                {d.weekday} {d.local_date.slice(5)}
              </th>
              <td className="py-1">{render(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export function TrendChart({
  days,
  metric,
  title,
  color,
  height = 170,
  showTable = true,
}: {
  days: InsightDay[]
  metric: Metric
  title: string
  color: string
  height?: number
  showTable?: boolean
}) {
  const data = days.map((d) => ({ day: d.weekday, date: d.local_date, value: d[metric] }))
  const pal = palette(color)
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      <div style={{ height }} role="img" aria-label={`${title}: ${data.map((d) => `${d.day} ${d.value ?? 'no check-in'}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.grid }} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v) => (v == null ? ['No check-in', title] : [`${v} / 5`, title])}
              labelFormatter={(_l, p) => (p?.[0]?.payload?.date as string) ?? ''}
              contentStyle={{ borderRadius: 12, borderColor: pal.grid, fontSize: 12 }}
            />
            <Line type="linear" dataKey="value" stroke={pal.line} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: pal.surface }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showTable && <ChartTable days={days} render={(d) => (d[metric] == null ? '—' : `${d[metric]} / 5`)} />}
    </figure>
  )
}

const SLEEP_LABEL: Record<number, string> = { 1: 'Poor', 2: 'Okay', 3: 'Good' }

export function SleepChart({ days, title, color }: { days: InsightDay[]; title: string; color: string }) {
  const data = days.map((d) => ({ day: d.weekday, date: d.local_date, value: d.sleep_value }))
  const pal = palette(color)
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      <div style={{ height: 170 }} role="img" aria-label={`${title}: ${days.map((d) => `${d.weekday} ${d.sleep_quality ?? 'no check-in'}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -6 }} barCategoryGap="30%">
            <CartesianGrid stroke={pal.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={{ stroke: pal.grid }} />
            <YAxis domain={[0, 3]} ticks={[1, 2, 3]} tickFormatter={(v: number) => SLEEP_LABEL[v] ?? ''} tick={{ fontSize: 11, fill: pal.muted }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: pal.grid, fillOpacity: 0.5 }}
              formatter={(v) => [v == null ? 'No check-in' : SLEEP_LABEL[Number(v)], title]}
              labelFormatter={(_l, p) => (p?.[0]?.payload?.date as string) ?? ''}
              contentStyle={{ borderRadius: 12, borderColor: pal.grid, fontSize: 12 }}
            />
            <Bar dataKey="value" fill={pal.line} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable days={days} render={(d) => d.sleep_quality ?? '—'} />
    </figure>
  )
}
