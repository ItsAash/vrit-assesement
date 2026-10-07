import { useMemo, useState } from 'react'

import { appointmentsApi } from '../api/client'
import { Field } from '../components/Ui'
import { todayISO } from '../utils/format'

const EMPTY_FORM = {
  customer_name: '',
  customer_phone: '',
  service: '',
  appointment_date: todayISO(),
  appointment_time: '',
  notes: '',
}

function validate(form, services) {
  const errors = {}
  if (!form.customer_name.trim()) errors.customer_name = 'Customer name is required.'

  const phone = form.customer_phone.trim()
  if (!phone) {
    errors.customer_phone = 'Customer phone is required.'
  } else if (!/^[\d+\-\s()]{7,}$/.test(phone)) {
    errors.customer_phone = 'Enter a valid phone number.'
  }

  if (!form.service) errors.service = 'Select a service.'

  if (!form.appointment_date) {
    errors.appointment_date = 'Appointment date is required.'
  } else if (form.appointment_date < todayISO()) {
    errors.appointment_date = 'Date cannot be in the past.'
  }

  if (!form.appointment_time) {
    errors.appointment_time = 'Appointment time is required.'
  }

  if (!services.length) {
    errors.service = 'Add a service before booking an appointment.'
  }

  return errors
}

export default function BookingPage({ services, onBooked, notify }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === form.service),
    [services, form.service],
  )

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setServerErrors((prev) => ({ ...prev, [name]: undefined }))
    setServerError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validate(form, services)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) return

    setSubmitting(true)
    setServerErrors({})
    setServerError(null)
    try {
      const created = await appointmentsApi.create({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        service: Number(form.service),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        notes: form.notes.trim(),
      })
      notify(`Appointment booked for ${created.customer_name}.`, 'success')
      setForm({ ...EMPTY_FORM, appointment_date: todayISO() })
      setErrors({})
      onBooked?.()
    } catch (err) {
      setServerErrors(err.fieldErrors ?? {})
      setServerError(
        err.fieldErrors && Object.keys(err.fieldErrors).length ? null : err.message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (name) => errors[name] ?? serverErrors[name]

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2>Book an appointment</h2>
          <p>Fill in the customer details and pick a slot.</p>
        </div>
      </header>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}

      {!services.length && (
        <p className="notice">
          No services available yet. Add a service on the Services tab first.
        </p>
      )}

      <form className="card booking-form" onSubmit={handleSubmit} noValidate>
        <div className="grid-2">
          <Field label="Customer name" htmlFor="customer_name" error={fieldError('customer_name')}>
            <input
              id="customer_name"
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              placeholder="Ram Sharma"
            />
          </Field>

          <Field
            label="Customer phone"
            htmlFor="customer_phone"
            error={fieldError('customer_phone')}
          >
            <input
              id="customer_phone"
              name="customer_phone"
              value={form.customer_phone}
              onChange={handleChange}
              placeholder="9801234567"
            />
          </Field>

          <Field label="Service" htmlFor="service" error={fieldError('service')}>
            <select
              id="service"
              name="service"
              value={form.service}
              onChange={handleChange}
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — NPR {Number(service.price).toLocaleString('en-IN')} ·{' '}
                  {service.duration} min
                </option>
              ))}
            </select>
          </Field>

          <div className="grid-2">
            <Field
              label="Appointment date"
              htmlFor="appointment_date"
              error={fieldError('appointment_date')}
            >
              <input
                id="appointment_date"
                name="appointment_date"
                type="date"
                min={todayISO()}
                value={form.appointment_date}
                onChange={handleChange}
              />
            </Field>

            <Field
              label="Appointment time"
              htmlFor="appointment_time"
              error={fieldError('appointment_time')}
            >
              <input
                id="appointment_time"
                name="appointment_time"
                type="time"
                step="300"
                value={form.appointment_time}
                onChange={handleChange}
              />
            </Field>
          </div>
        </div>

        <Field
          label="Notes (optional)"
          htmlFor="notes"
          hint="Anything the stylist should know."
        >
          <textarea
            id="notes"
            name="notes"
            rows="3"
            value={form.notes}
            onChange={handleChange}
            placeholder="Prefers a short trim."
          />
        </Field>

        {selectedService && (
          <p className="booking-form__summary">
            Duration: <strong>{selectedService.duration} min</strong>
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setForm({ ...EMPTY_FORM, appointment_date: todayISO() })
              setErrors({})
              setServerErrors({})
            }}
          >
            Reset
          </button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Booking...' : 'Book appointment'}
          </button>
        </div>
      </form>
    </section>
  )
}