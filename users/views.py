from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import generics, permissions
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .serializers import RegisterSerializer, UserSerializer


User = get_user_model()


def _make_unique_username(base: str) -> str:
    candidate = (base or "user").strip().lower()
    candidate = "".join(ch for ch in candidate if ch.isalnum() or ch in "._-")
    if not candidate:
        candidate = "user"
    candidate = candidate[:150]

    if not User.objects.filter(username=candidate).exists():
        return candidate

    idx = 1
    while True:
        suffix = f"_{idx}"
        trimmed = candidate[: 150 - len(suffix)]
        next_candidate = f"{trimmed}{suffix}"
        if not User.objects.filter(username=next_candidate).exists():
            return next_candidate
        idx += 1


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # We authenticate by email on API layer, username stays internal.
        self.fields.pop(self.username_field, None)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["xp"] = user.xp
        token["level"] = user.level
        return token

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        if not email:
            raise serializers.ValidationError({"email": "Email is required."})

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError({"detail": "No account with this email."})

        attrs[self.username_field] = user.username
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class SetPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = (request.data or {}).get("password") or ""
        if len(password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password saved."}, status=status.HTTP_200_OK)


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw = request.data or {}
        token = raw.get("id_token") or raw.get("credential")
        requested_username = (raw.get("username") or "").strip()
        requested_password = raw.get("password") or ""
        if not token:
            return Response({"detail": "Missing id_token."}, status=status.HTTP_400_BAD_REQUEST)

        if not getattr(settings, "GOOGLE_CLIENT_ID", ""):
            return Response(
                {"detail": "Server is not configured for Google Sign-In (missing GOOGLE_CLIENT_ID)."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            info = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            return Response({"detail": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)

        email = (info.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Google account has no email."}, status=status.HTTP_400_BAD_REQUEST)

        default_base = email.split("@")[0]
        if info.get("sub"):
            default_base = f"{default_base}_{str(info.get('sub'))[:8]}"
        username_for_new_user = _make_unique_username(requested_username or default_base)

        # Create or get local user by email (unique), then optionally set local creds.
        user, created = User.objects.get_or_create(email=email, defaults={"username": username_for_new_user})

        if created and requested_password and len(requested_password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        should_update = False

        # If user comes from Google and wants classic login, allow setting local username.
        if requested_username and requested_username != user.username:
            if User.objects.filter(username=requested_username).exclude(pk=user.pk).exists():
                return Response({"detail": "This username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = requested_username
            should_update = True

        if requested_password:
            if len(requested_password) < 6:
                return Response(
                    {"detail": "Password must be at least 6 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(requested_password)
            should_update = True
        if created:
            # If password was not provided, keep Google-only account behavior.
            if not requested_password:
                user.set_unusable_password()
                should_update = True

        if should_update:
            user.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": UserSerializer(user).data,
            }
        )
