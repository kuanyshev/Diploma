from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # Email must be unique per account. We keep it nullable to avoid breaking
    # existing rows that may have empty email during migration.
    email = models.EmailField(unique=True, null=True, blank=True)
    xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    onboarding_completed = models.BooleanField(default=False)
