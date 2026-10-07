from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    # Root sends visitors straight to the React booking desk.
    path(
        "",
        RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False),
        name="root",
    ),
    path("api/", include("booking.urls")),
    path("admin/", admin.site.urls),
]