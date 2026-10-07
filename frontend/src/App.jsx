import { useCallback, useMemo, useState } from 'react'

import { appointmentsApi, servicesApi, summaryApi } from './api/client'
import AppointmentsPage from './pages/AppointmentsPage'
import BookingPage from './pages/BookingPage'
import ServicesPage from './pages/ServicesPage'
import SummaryBar from './components/SummaryBar'
import { Toast } from './components/Ui'
import { useFetch } from './hooks/useFetch'

const TABS = [
  { id: 'booking', label: 'Book Appointment' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'services', label: 'Services' },
]

export default function App() {
  const [tab, setTab] = useState('booking')
  const [filters, setFilters] = useState({ status: '', date: '', search: '' })
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  const services = useFetch(() => servicesApi.list(), [])
  const summary = useFetch(() => summaryApi.get(), [])

  const appointments = useFetch(
    () => appointmentsApi.list(filters),
    [filters.status, filters.date, filters.search],
  )

  const refreshAll = useCallback(async () => {
    await Promise.all([appointments.reload(), summary.reload()])
  }, [appointments, summary])

  const serviceRows = services.data ?? []
  const summaryData = useMemo(() => summary.data, [summary.data])

  function handleFilterChange(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleBooked() {
    refreshAll()
    setTab('appointments')
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <h1>Vivre Salon</h1>
          <p>Appointment booking desk</p>
        </div>
        <nav className="app__tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab${tab === item.id ? ' tab--active' : ''}`}
              aria-current={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        <SummaryBar summary={summaryData} loading={summary.loading} />

        {tab === 'booking' && (
          <BookingPage
            services={serviceRows}
            onBooked={handleBooked}
            notify={notify}
          />
        )}

        {tab === 'appointments' && (
          <AppointmentsPage
            appointments={appointments.data}
            loading={appointments.loading}
            error={appointments.error}
            reload={appointments.reload}
            filters={filters}
            onFilterChange={handleFilterChange}
            notify={notify}
          />
        )}

        {tab === 'services' && (
          <ServicesPage
            services={services.data}
            loading={services.loading}
            error={services.error}
            reload={services.reload}
            notify={notify}
          />
        )}
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}