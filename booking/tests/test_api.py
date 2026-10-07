from datetime import time, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from booking.models import Appointment, Service


class ServiceApiTests(APITestCase):
    def test_list_services(self):
        Service.objects.create(name="Haircut", price=500, duration=30)
        response = self.client.get(reverse("service-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_create_service(self):
        response = self.client.post(
            reverse("service-list"),
            {"name": "Facial", "price": "1500", "duration": 60},
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Service.objects.filter(name="Facial").exists())

    def test_create_service_validation_errors(self):
        response = self.client.post(
            reverse("service-list"),
            {"name": "", "price": 0, "duration": 0},
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("name", body)
        self.assertIn("price", body)
        self.assertIn("duration", body)

    def test_update_service(self):
        service = Service.objects.create(name="Haircut", price=500, duration=30)
        response = self.client.put(
            reverse("service-detail", args=[service.pk]),
            {"name": "Haircut Deluxe", "price": "800", "duration": 45},
        )
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.name, "Haircut Deluxe")
        self.assertEqual(service.price, 800)

    def test_delete_service(self):
        service = Service.objects.create(name="Facial", price=1500, duration=60)
        response = self.client.delete(reverse("service-detail", args=[service.pk]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Service.objects.exists())

    def test_delete_service_with_appointments_conflicts(self):
        service = Service.objects.create(name="Haircut", price=500, duration=30)
        Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=service,
            appointment_date=timezone.localdate(),
            appointment_time=time(10, 0),
        )
        response = self.client.delete(reverse("service-detail", args=[service.pk]))
        self.assertEqual(response.status_code, 409)

    def test_unknown_service_returns_404(self):
        response = self.client.get(reverse("service-detail", args=[999]))
        self.assertEqual(response.status_code, 404)


class AppointmentApiTests(APITestCase):
    def setUp(self):
        self.service = Service.objects.create(name="Haircut", price=500, duration=30)
        self.other_service = Service.objects.create(
            name="Facial", price=1500, duration=60
        )
        self.date = (timezone.localdate() + timedelta(days=1)).isoformat()

    def _payload(self, **overrides):
        payload = {
            "customer_name": "Ram Sharma",
            "customer_phone": "9801234567",
            "service": self.service.pk,
            "appointment_date": self.date,
            "appointment_time": "10:00",
        }
        payload.update(overrides)
        return payload

    def test_create_appointment(self):
        response = self.client.post(reverse("appointment-list"), self._payload())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Appointment.objects.count(), 1)
        self.assertEqual(response.json()["status"], "pending")

    def test_create_appointment_missing_fields(self):
        response = self.client.post(
            reverse("appointment-list"),
            {"customer_name": "", "customer_phone": ""},
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        for field in (
            "customer_name",
            "customer_phone",
            "service",
            "appointment_date",
            "appointment_time",
        ):
            self.assertIn(field, body)

    def test_create_appointment_past_date_rejected(self):
        response = self.client.post(
            reverse("appointment-list"),
            self._payload(
                appointment_date=(timezone.localdate() - timedelta(days=1)).isoformat()
            ),
        )
        self.assertEqual(response.status_code, 400)

    def test_double_booking_same_service_and_slot_rejected(self):
        self.client.post(reverse("appointment-list"), self._payload())
        response = self.client.post(
            reverse("appointment-list"), self._payload(customer_name="Sita Thapa")
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_time", response.json())

    def test_same_slot_different_service_allowed(self):
        self.client.post(reverse("appointment-list"), self._payload())
        response = self.client.post(
            reverse("appointment-list"), self._payload(service=self.other_service.pk)
        )
        self.assertEqual(response.status_code, 201)

    def test_cancelled_appointment_frees_the_slot(self):
        appointment = Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
            status=Appointment.Status.CANCELLED,
        )
        response = self.client.post(
            reverse("appointment-list"),
            self._payload(),
        )
        self.assertEqual(response.status_code, 201)
        appointment.delete()

    def test_filter_appointments_by_status(self):
        Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
            status=Appointment.Status.CONFIRMED,
        )
        Appointment.objects.create(
            customer_name="Sita",
            customer_phone="9812345678",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(12, 0),
            status=Appointment.Status.PENDING,
        )
        response = self.client.get(reverse("appointment-list"), {"status": "confirmed"})
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "confirmed")

    def test_search_appointments(self):
        Appointment.objects.create(
            customer_name="Ram Sharma",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
        )
        response = self.client.get(reverse("appointment-list"), {"search": "ram"})
        self.assertEqual(len(response.json()), 1)

    def test_update_status(self):
        appointment = Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
        )
        response = self.client.patch(
            reverse("appointment-status", args=[appointment.pk]), {"status": "completed"}
        )
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Status.COMPLETED)

    def test_update_status_invalid_value(self):
        appointment = Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
        )
        response = self.client.patch(
            reverse("appointment-status", args=[appointment.pk]), {"status": "archived"}
        )
        self.assertEqual(response.status_code, 400)

    def test_delete_appointment(self):
        appointment = Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
        )
        response = self.client.delete(
            reverse("appointment-detail", args=[appointment.pk])
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Appointment.objects.exists())

    def test_delete_unknown_appointment_returns_404(self):
        response = self.client.delete(reverse("appointment-detail", args=[999]))
        self.assertEqual(response.status_code, 404)

    def test_summary_endpoint(self):
        Appointment.objects.create(
            customer_name="Ram",
            customer_phone="9801234567",
            service=self.service,
            appointment_date=self.date,
            appointment_time=time(10, 0),
            status=Appointment.Status.COMPLETED,
        )
        response = self.client.get(reverse("booking-summary"))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total_appointments"], 1)
        self.assertEqual(body["revenue_from_completed"], "500.00")