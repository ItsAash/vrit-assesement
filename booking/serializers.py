from decimal import Decimal

from rest_framework import serializers

from .models import Appointment, Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "price", "duration"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Service name cannot be empty.")
        return name

    def validate_price(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Price must be a positive number.")
        return value

    def validate_duration(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Duration must be greater than zero.")
        return value

    def validate(self, attrs):
        name = attrs.get("name")
        if name:
            queryset = Service.objects.filter(name__iexact=name.strip())
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"name": "A service with this name already exists."}
                )
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_price = serializers.DecimalField(
        source="service.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
        min_value=Decimal("0.01"),
    )

    class Meta:
        model = Appointment
        fields = [
            "id",
            "customer_name",
            "customer_phone",
            "service",
            "service_name",
            "service_price",
            "appointment_date",
            "appointment_time",
            "notes",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "status"]

    def validate_customer_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Customer name cannot be empty.")
        return name

    def validate_customer_phone(self, value):
        phone = value.strip()
        if not phone:
            raise serializers.ValidationError("Customer phone cannot be empty.")
        if not phone.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            raise serializers.ValidationError(
                "Customer phone must contain digits only."
            )
        return phone

    def validate_service(self, value):
        if not Service.objects.filter(pk=value.pk).exists():
            raise serializers.ValidationError("Selected service does not exist.")
        return value

    def validate(self, attrs):
        service = attrs.get("service")
        date = attrs.get("appointment_date")
        time = attrs.get("appointment_time")

        missing = [
            name
            for name, value in (
                ("appointment_date", date),
                ("appointment_time", time),
            )
            if value in (None, "")
        ]
        if missing:
            raise serializers.ValidationError(
                {field: "This field is required." for field in missing}
            )

        if date and date < self._today():
            raise serializers.ValidationError(
                {"appointment_date": "Appointment date cannot be in the past."}
            )

        if service and date and time:
            clash = Appointment.objects.filter(
                service=service,
                appointment_date=date,
                appointment_time=time,
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError(
                    {
                        "appointment_time": (
                            f"This time slot is already booked for "
                            f"{service.name} on {date} at {time}."
                        )
                    }
                )

        return attrs

    @staticmethod
    def _today():
        from django.utils import timezone

        return timezone.localdate()


class AppointmentStatusSerializer(serializers.Serializer):
    """Used by PATCH /api/appointments/:id/status."""

    status = serializers.ChoiceField(choices=Appointment.Status.choices)

    def validate_status(self, value):
        if value == Appointment.Status.CANCELLED and not value:
            raise serializers.ValidationError("Status cannot be empty.")
        return value