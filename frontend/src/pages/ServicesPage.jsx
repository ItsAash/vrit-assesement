import { useMemo, useState } from 'react'

import { servicesApi } from '../api/client'
import { Field, Modal } from '../components/Ui'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { formatPrice } from '../utils/format'

const EMPTY_FORM = { name: '', price: '', duration: '' }

function ServiceForm({ initial, onSubmit, onCancel, submitting, errors, serverError }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name ?? '',
          price: String(initial.price ?? ''),
          duration: String(initial.duration ?? ''),
        }
      : EMPTY_FORM,
  )
  const [clientErrors, setClientErrors] = useState({})

  const errors_ = { ...clientErrors, ...errors }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setClientErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Service name is required.'
    if (form.price === '' || Number.isNaN(Number(form.price))) {
      next.price = 'Price is required.'
    } else if (Number(form.price) <= 0) {
      next.price = 'Price must be a positive number.'
    }
    if (form.duration === '' || Number.isNaN(Number(form.duration))) {
      next.duration = 'Duration is required.'
    } else if (Number(form.duration) <= 0) {
      next.duration = 'Duration must be greater than zero.'
    }
    setClientErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    onSubmit({
      name: form.name.trim(),
      price: Number(form.price),
      duration: Number(form.duration),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      <Field label="Service name" htmlFor="service-name" error={errors_.name}>
        <input
          id="service-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Haircut"
        />
      </Field>
      <Field label="Price (NPR)" htmlFor="service-price" error={errors_.price}>
        <input
          id="service-price"
          name="price"
          type="number"
          min="0"
          step="1"
          value={form.price}
          onChange={handleChange}
          placeholder="500"
        />
      </Field>
      <Field
        label="Duration (minutes)"
        htmlFor="service-duration"
        error={errors_.duration}
      >
        <input
          id="service-duration"
          name="duration"
          type="number"
          min="1"
          step="5"
          value={form.duration}
          onChange={handleChange}
          placeholder="30"
        />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Update service' : 'Add service'}
        </button>
      </div>
    </form>
  )
}

export default function ServicesPage({ services, loading, error, reload, notify }) {
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [deletingId, setDeletingId] = useState(null)

  const hasServices = useMemo(() => services?.length > 0, [services])

  function openCreate() {
    setEditing(null)
    setServerError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(service) {
    setEditing(service)
    setServerError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setServerError(null)
    setFieldErrors({})
  }

  async function handleSubmit(payload) {
    setSubmitting(true)
    setServerError(null)
    setFieldErrors({})
    try {
      if (editing) {
        await servicesApi.update(editing.id, payload)
        notify(`${payload.name} updated.`, 'success')
      } else {
        await servicesApi.create(payload)
        notify(`${payload.name} added.`, 'success')
      }
      closeModal()
      await reload()
    } catch (err) {
      setFieldErrors(err.fieldErrors ?? {})
      setServerError(err.fieldErrors && Object.keys(err.fieldErrors).length ? null : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(service) {
    const confirmed = window.confirm(
      `Delete "${service.name}"? This cannot be undone.`,
    )
    if (!confirmed) return
    setDeletingId(service.id)
    try {
      await servicesApi.remove(service.id)
      notify(`${service.name} deleted.`, 'success')
      await reload()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2>Services</h2>
          <p>Manage what the salon offers. Prices are in NPR.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          + Add service
        </button>
      </header>

      {loading && <Spinner label="Loading services..." />}
      {error && !loading && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && !hasServices && (
        <EmptyState
          title="No services yet"
          hint="Add your first salon service to start taking bookings."
          action={
            <button type="button" className="btn" onClick={openCreate}>
              + Add service
            </button>
          }
        />
      )}

      {hasServices && (
        <div className="card-grid">
          {services.map((service) => (
            <article className="service-card" key={service.id}>
              <h3>{service.name}</h3>
              <p className="service-card__meta">
                {formatPrice(service.price)} · {service.duration} min
              </p>
              <div className="service-card__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => openEdit(service)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => handleDelete(service)}
                  disabled={deletingId === service.id}
                >
                  {deletingId === service.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit service' : 'Add service'} onClose={closeModal}>
          <ServiceForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitting={submitting}
            errors={fieldErrors}
            serverError={serverError}
          />
        </Modal>
      )}
    </section>
  )
}