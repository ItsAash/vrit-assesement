import { useState } from 'react'

import { appointmentsApi } from '../api/client'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import {
  STATUS_LABELS,
  STATUSES,
  allowedTransitions,
  formatPrice,
  formatTime,
} from '../utils/format'

export default function AppointmentsPage({
  appointments,
  loading,
  error,
  reload,
  filters,
  onFilterChange,
  notify,
}) {
  const [busyId, setBusyId] = useState(null)

  async function handleStatusChange(appointment, status) {
    setBusyId(appointment.id)
    try {
      await appointmentsApi.updateStatus(appointment.id, status)
      notify(`${appointment.customer_name} marked as ${STATUS_LABELS[status]}.`, 'success')
      await reload()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(appointment) {
    const confirmed = window.confirm(
      `Delete the appointment for ${appointment.customer_name} on ${appointment.appointment_date}?`,
    )
    if (!confirmed) return
    setBusyId(appointment.id)
    try {
      await appointmentsApi.remove(appointment.id)
      notify('Appointment deleted.', 'success')
      await reload()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const hasRows = appointments?.length > 0

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2>Appointments</h2>
          <p>Review bookings, update statuses, or remove them.</p>
        </div>
      </header>

      <div className="card filters">
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => onFilterChange({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-date">Date</label>
          <input
            id="filter-date"
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange({ date: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-search">Customer name / phone</label>
          <input
            id="filter-search"
            type="search"
            value={filters.search}
            placeholder="Search"
            onChange={(event) => onFilterChange({ search: event.target.value })}
          />
        </div>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onFilterChange({ status: '', date: '', search: '' })}
        >
          Clear
        </button>
      </div>

      {loading && <Spinner label="Loading appointments..." />}
      {error && !loading && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && !hasRows && (
        <EmptyState
          title="No appointments found"
          hint="Adjust the filters, or book a new appointment from the Booking tab."
        />
      )}

      {hasRows && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td>
                    <strong>{appointment.customer_name}</strong>
                    <small>{appointment.customer_phone}</small>
                    {appointment.notes && <small className="muted">Note: {appointment.notes}</small>}
                  </td>
                  <td>
                    {appointment.service_name}
                    <small>{formatPrice(appointment.service_price)}</small>
                  </td>
                  <td>{appointment.appointment_date}</td>
                  <td>{formatTime(appointment.appointment_time)}</td>
                  <td>
                    <span className={`badge badge--${appointment.status}`}>
                      {STATUS_LABELS[appointment.status] ?? appointment.status}
                    </span>
                  </td>
                  <td className="table__actions">
                    <select
                      value={appointment.status}
                      disabled={busyId === appointment.id}
                      aria-label={`Update status for ${appointment.customer_name}`}
                      onChange={(event) => handleStatusChange(appointment, event.target.value)}
                    >
                      {STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                    <div className="table__quick">
                      {allowedTransitions(appointment.status).map((next) => (
                        <button
                          key={next}
                          type="button"
                          className="btn btn--small"
                          disabled={busyId === appointment.id}
                          onClick={() => handleStatusChange(appointment, next)}
                        >
                          {STATUS_LABELS[next]}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        disabled={busyId === appointment.id}
                        onClick={() => handleDelete(appointment)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}