export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const message =
    error?.fieldErrors && Object.keys(error.fieldErrors).length
      ? Object.entries(error.fieldErrors)
          .map(([field, text]) => `${field}: ${text}`)
          .join(' • ')
      : error?.message ?? 'Something went wrong.'

  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="state state--empty">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}