"""Seed the database with the sample services and appointments from the brief.

Usage:
    python manage.py seed_data          # only seed when tables are empty
    python manage.py seed_data --force  # wipe bookings and re-seed
"""

from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from booking.models import Appointment, Service

SERVICES = [
    {"name": "Haircut", "price": "500.00", "duration": 30},
    {"name": "Hair Coloring", "price": "2500.00", "duration": 120},
    {"name": "Facial", "price": "1500.00", "duration": 60},
]

APPOINTMENTS = [
    {
        "customer_name": "Ram Sharma",
        "customer_phone": "9801234567",
        "service": "Haircut",
        "appointment_time": time(10, 0),
        "status": Appointment.Status.PENDING,
        "notes": "First visit, prefers a short trim.",
    },
    {
        "customer_name": "Sita Thapa",
        "customer_phone": "9812345678",
        "service": "Facial",
        "appointment_time": time(11, 0),
        "status": Appointment.Status.CONFIRMED,
        "notes": "Sensitive skin, use mild products.",
    },
    {
        "customer_name": "Anita Gurung",
        "customer_phone": "9823456789",
        "service": "Hair Coloring",
        "appointment_time": time(14, 30),
        "status": Appointment.Status.COMPLETED,
        "notes": "",
    },
]


class Command(BaseCommand):
    help = "Seed sample services and appointments."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing services and appointments before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["force"]:
            Appointment.objects.all().delete()
            Service.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared existing data."))
        elif Service.objects.exists():
            self.stdout.write("Data already present. Use --force to re-seed.")
            return

        services = {}
        for payload in SERVICES:
            service, _ = Service.objects.update_or_create(
                name=payload["name"],
                defaults={"price": payload["price"], "duration": payload["duration"]},
            )
            services[service.name] = service
            self.stdout.write(f"Service: {service}")

        base_date = timezone.localdate() + timedelta(days=1)
        for payload in APPOINTMENTS:
            appointment, created = Appointment.objects.get_or_create(
                customer_name=payload["customer_name"],
                appointment_date=base_date,
                appointment_time=payload["appointment_time"],
                defaults={
                    "customer_phone": payload["customer_phone"],
                    "service": services[payload["service"]],
                    "notes": payload["notes"],
                    "status": payload["status"],
                },
            )
            verb = "Created" if created else "Exists"
            self.stdout.write(f"Appointment: {verb} {appointment}")

        self.stdout.write(self.style.SUCCESS("Seed data ready."))