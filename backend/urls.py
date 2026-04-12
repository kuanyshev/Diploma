"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

from rest_framework_simplejwt.views import TokenRefreshView

from ai.views import ai_chat_view
from users.views import RegisterView, LoginView, MeView, GoogleLoginView, SetPasswordView

urlpatterns = [
    path('', RedirectView.as_view(url='/habits/', permanent=False)),
    path('admin/', admin.site.urls),
    path('habits/', include('habits.urls')),
    path('api/community/', include('community.urls')),

    # auth API
    path('api/auth/register/', RegisterView.as_view(), name='api_register'),
    path('api/auth/login/', LoginView.as_view(), name='api_login'),
    path('api/auth/google/', GoogleLoginView.as_view(), name='api_google_login'),
    path('api/auth/set-password/', SetPasswordView.as_view(), name='api_set_password'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('api/auth/me/', MeView.as_view(), name='api_me'),
    path('api/ai/chat/', ai_chat_view, name='api_ai_chat'),
]
