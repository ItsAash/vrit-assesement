"""Function based REST API views for services and appointments.

All views return plain JSON via Django REST Framework serializers and use
appropriate HTTP status codes (200 / 201 / 400 / 404 / 405 / 409).
"""

from django.db.models import Q
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Appointment, Service
from .serializers import (
    AppointmentSerializer,
    AppointmentStatusSerializer,
    ServiceSerializer,
)


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
def service_list(request):
    """GET /api/services -> list services. POST /api/services -> create one."""
    if request.method == "GET":
        services = Service.objects.all()
        search = request.query_params.get("search", "").strip()
        if search:
            services = services.filter(name__icontains=search)
        return Response(ServiceSerializer(services, many=True).data)

    serializer = ServiceSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=http_status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def service_detail(request, pk):
    """Read / update / delete a single service."""
    try:
        service = Service.objects.get(pk=pk)
    except Service.DoesNotExist:
        return Response(
            {"detail": "Service not found."}, status=http_status.HTTP_404_NOT_FOUND
        )

    if request.method == "GET":
        return Response(ServiceSerializer(service).data)

    if request.method == "DELETE":
        if service.appointments.exists():
            return Response(
                {
                    "detail": (
                        "This service has appointments attached and cannot be "
                        "deleted. Remove the appointments first."
                    )
                },
                status=http_status.HTTP_409_CONFLICT,
            )
        service.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    serializer = ServiceSerializer(service, data=request.data, partial=(request.method == "PATCH"))
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=http_status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
def appointment_list(request):
    """GET /api/appointments -> list. POST /api/appointments -> create."""
    if request.method == "GET":
        appointments = Appointment.objects.select_related("service")

        status_filter = request.query_params.get("status", "").strip().lower()
        if status_filter:
            appointments = appointments.filter(status=status_filter)

        date_filter = request.query_params.get("date", "").strip()
        if date_filter:
            appointments = appointments.filter(appointment_date=date_filter)

        search = request.query_params.get("search", "").strip()
        if search:
            appointments = appointments.filter(
                Q(customer_name__icontains=search) | Q(customer_phone__icontains=search)
            )

        service_filter = request.query_params.get("service", "").strip()
        if service_filter:
            appointments = appointments.filter(service_id=service_filter)

        page = _positive_int(request.query_params.get("page"))
        page_size = min(_positive_int(request.query_params.get("page_size")) or 20, 100)

        total = appointments.count()
        if page:
            offset = (page - 1) * page_size
            page_items = appointments[offset:offset + page_size]
            return Response(
                {
                    "count": total,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": (total + page_size - 1) // page_size,
                    "results": AppointmentSerializer(page_items, many=True).data,
                }
            )

        return Response(AppointmentSerializer(appointments, many=True).data)

    serializer = AppointmentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=http_status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
def appointment_detail(request, pk):
    try:
        appointment = Appointment.objects.select_related("service").get(pk=pk)
    except Appointment.DoesNotExist:
        return Response(
            {"detail": "Appointment not found."},
            status=http_status.HTTP_404_NOT_FOUND,
        )

    if request.method == "DELETE":
        appointment.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    return Response(AppointmentSerializer(appointment).data)


@api_view(["PATCH", "PUT"])
def appointment_status(request, pk):
    """PATCH /api/appointments/:id/status -> update the appointment status."""
    try:
        appointment = Appointment.objects.get(pk=pk)
    except Appointment.DoesNotExist:
        return Response(
            {"detail": "Appointment not found."},
            status=http_status.HTTP_404_NOT_FOUND,
        )

    serializer = AppointmentStatusSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

    appointment.status = serializer.validated_data["status"]
    appointment.save(update_fields=["status", "updated_at"])
    return Response(AppointmentSerializer(appointment).data)


@api_view(["GET"])
def booking_summary(request):
    """Bonus: totals for appointments and revenue."""
    appointments = Appointment.objects.select_related("service")
    status_filter = request.query_params.get("status", "").strip().lower()
    if status_filter:
        appointments = appointments.filter(status=status_filter)

    revenue = sum(
        appointment.service.price
        for appointment in appointments
        if appointment.status == Appointment.Status.COMPLETED
    )

    counts = {
        value: appointments.filter(status=value).count()
        for value in Appointment.Status.values
    }

    return Response(
        {
            "total_appointments": appointments.count(),
            "total_services": Service.objects.count(),
            "revenue_from_completed": str(revenue),
            "status_counts": counts,
        }
    )


def _positive_int(raw):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None