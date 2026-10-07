from django.urls import path

from . import views

urlpatterns = [
    path("services", views.service_list, name="service-list"),
    path("services/<int:pk>", views.service_detail, name="service-detail"),
    path("appointments", views.appointment_list, name="appointment-list"),
    path(
        "appointments/<int:pk>",
        views.appointment_detail,
        name="appointment-detail",
    ),
    path(
        "appointments/<int:pk>/status",
        views.appointment_status,
        name="appointment-status",
    ),
    path("summary", views.booking_summary, name="booking-summary"),
]