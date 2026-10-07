const TILES = [
  { key: 'total_appointments', label: 'Appointments' },
  { key: 'total_services', label: 'Services' },
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'revenue_from_completed', label: 'Revenue (completed)', money: true },
]

export default function SummaryBar({ summary, loading }) {
  if (loading || !summary) {
    return <div className="summary summary--loading" aria-hidden="true" />
  }

  return (
    <div className="summary">
      {TILES.map((tile) => {
        const raw =
          tile.key === 'completed'
            ? summary.status_counts?.completed
            : tile.key === 'pending'
              ? summary.status_counts?.pending
              : summary[tile.key]
        const value = tile.money ? `NPR ${Number(raw ?? 0).toLocaleString('en-IN')}` : raw ?? 0
        return (
          <div className="summary__tile" key={tile.key}>
            <span className="summary__label">{tile.label}</span>
            <strong className="summary__value">{value}</strong>
          </div>
        )
      })}
    </div>
  )
}