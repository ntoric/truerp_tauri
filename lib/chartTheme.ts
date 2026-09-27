export const CHART_COLORS = { primary: '#c81e3a', ink: '#111111', muted: '#9ca3af', positive: '#059669', grid: '#eef0f5', axis: '#5b5c6b' } as const
export const chartAxisProps = { tick: { fill: CHART_COLORS.axis, fontSize: 12 }, axisLine: { stroke: CHART_COLORS.grid }, tickLine: false } as const
export const chartTooltipProps = { contentStyle: { borderRadius: 10, border: '1px solid #e4e6ef', boxShadow: '0 8px 24px rgba(17,17,17,0.08)', fontSize: 12 }, cursor: { fill: 'rgba(200,30,58,0.06)' } } as const
