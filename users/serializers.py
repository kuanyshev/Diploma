from django.contrib.auth import get_user_model
from rest_framework import serializers


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()

    def get_has_password(self, obj):
        return obj.has_usable_password()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "xp",
            "level",
            "date_joined",
            "onboarding_completed",
            "has_password",
        )
        read_only_fields = ("id", "xp", "level", "date_joined", "has_password")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField(required=True, allow_blank=False)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email"),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user

