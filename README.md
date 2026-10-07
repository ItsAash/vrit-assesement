# Salon Appointment Booking System

Appointment booking system for a beauty salon, built as an in-house coding
assessment for Vrit Technologies.

- **Backend:** Django + Django REST Framework, function based views
- **Frontend:** React (Vite)
- **Database:** SQLite by default (PostgreSQL supported through env vars)

---

## 1. Prerequisites

- Python 3.10+
- Node.js 18+

## 2. Backend setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py seed_data       # sample services + appointments
python manage.py runserver
```

The API is served at http://127.0.0.1:8000/api/ (DRF's browsable API is
enabled, so endpoints can be tried from the browser). Opening
http://127.0.0.1:8000/ redirects to the React app on port 5173.

No `.env` file is required. Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | insecure dev key | Django secret key |
| `DEBUG` | `True` | Debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,0.0.0.0,[::1]` | Comma separated hosts |
| `DB_ENGINE` | `sqlite` | Set to `postgres` to use PostgreSQL |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | – | Used when `DB_ENGINE=postgres` |
| `TIME_ZONE` | `Asia/Kathmandu` | Timezone used for "today" checks |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Extra origins for the React dev server |
| `FRONTEND_URL` | `http://localhost:5173` | Where `/` redirects to |

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://127.0.0.1:8000`,
so both servers run side by side with no extra configuration. For a production
build use `npm run build` and serve `frontend/dist` from any static host; point
it at a different API with `VITE_API_URL=http://host:port/api`.

## 4. Running the tests

```bash
python manage.py test booking
```

20 API tests cover CRUD, validation, status transitions, double-booking
conflicts, filtering and the summary endpoint.

---

## API reference

Base URL: `/api`

### Services

| Method | Endpoint | Description | Success |
| --- | --- | --- | --- |
| GET | `/api/services` | List services. Optional `?search=` | 200 |
| POST | `/api/services` | Create a service | 201 |
| GET | `/api/services/:id` | Retrieve a service | 200 |
| PUT / PATCH | `/api/services/:id` | Update a service | 200 |
| DELETE | `/api/services/:id` | Delete a service | 204 |

Service payload: `{ "name": "Haircut", "price": 500, "duration": 30 }`

### Appointments

| Method | Endpoint | Description | Success |
| --- | --- | --- | --- |
| GET | `/api/appointments` | List appointments | 200 |
| POST | `/api/appointments` | Create an appointment | 201 |
| GET | `/api/appointments/:id` | Retrieve an appointment | 200 |
| PATCH / PUT | `/api/appointments/:id/status` | Update status | 200 |
| DELETE | `/api/appointments/:id` | Delete an appointment | 204 |
| GET | `/api/summary` | Counts + revenue from completed bookings | 200 |

Query parameters for `GET /api/appointments`: `status`, `date`, `search`
(customer name or phone), `service` (id), `page`, `page_size`.

Appointment payload:

```json
{
  "customer_name": "Ram Sharma",
  "customer_phone": "9801234567",
  "service": 1,
  "appointment_date": "2026-10-09",
  "appointment_time": "10:00",
  "notes": "First visit"
}
```

Status payload: `{ "status": "confirmed" }` where status is one of
`pending`, `confirmed`, `completed`, `cancelled`.

### Error responses

- `400 Bad Request` — validation errors keyed by field
  (`{"customer_name": ["Customer name cannot be empty."]}`)
- `404 Not Found` — unknown id, `{"detail": "Appointment not found."}`
- `409 Conflict` — deleting a service that still has appointments
- `405 Method Not Allowed` — wrong verb for the endpoint

---

## Architecture

```
app/                 Django project (settings, root urls)
booking/             Booking app — models, serializers, API views, tests
  models.py          Service, Appointment
  serializers.py     Field validation + double-booking rule
  views.py           Function based API views
  urls.py            /api/* routes
  management/        seed_data command
frontend/            React (Vite) single page app
  src/api/           fetch client, ApiError, per-resource endpoints
  src/components/    Field, Modal, Toast, shared states, summary tiles
  src/pages/         BookingPage, AppointmentsPage, ServicesPage
  src/hooks/         useFetch (loading / error / refetch)
  src/utils/         formatting and status transitions
users/               Custom email-based user model, used by the Django admin
```

### Backend decisions

- **Function based views** (`@api_view`) as required by the brief. Each view
  handles only its own verbs and returns explicit status codes.
- **Serializers own validation.** Model-level `MinValueValidator`s plus
  serializer field checks give layered errors, and DRF turns them into
  field-keyed `400` responses, which the frontend maps straight onto form
  inputs.
- **`Appointment.service` is `on_delete=PROTECT`.** A service with existing
  bookings cannot be deleted; the API answers `409` with a clear message
  instead of silently cascading away appointment history.
- **Double-booking rule** lives in `AppointmentSerializer.validate()`: a new
  booking is rejected if an appointment for the same service, date and time
  already exists and is not cancelled. Cancelled slots are free again, and
  `status` is read-only on the create/update serializer so it can only change
  through the dedicated status endpoint.
- **Database indexes** on `(service, appointment_date, appointment_time)` and
  `status` keep the conflict check and the status filter cheap as data grows.
- **SQLite by default** so the project runs with zero configuration; the
  settings switch to PostgreSQL when `DB_ENGINE=postgres` is set.

### Frontend decisions

- **One component per requirement** (`BookingPage`, `AppointmentsPage`,
  `ServicesPage`) sharing `Field`, `Modal`, `Toast` and the loading/error/empty
  state components.
- **Validation runs twice**: client side for instant feedback, server side as
  the source of truth. Server field errors are merged into the same form state,
  so a rejected booking shows the message under the offending input.
- **`useFetch`** centralises loading/error state so every page handles API
  failures the same way, with a retry action.
- **Status updates** are available both as a dropdown (any valid status) and as
  transition buttons limited to the allowed next steps.
- Plain CSS with a small design-token set, no UI library, responsive down to
  small screens.

### Bonus features included

- Search appointments by customer name or phone, filter by date and service
- Optional pagination (`?page=1&page_size=20`) on the appointments endpoint
- Summary tiles: total appointments, total services, completed/pending counts and
  revenue from completed bookings
- 20 automated backend tests (`python manage.py test booking`)