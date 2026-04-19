web: bash -c 'unset GUNICORN_CMD_ARGS; exec gunicorn --access-logfile - --error-logfile - --bind 0.0.0.0:"${PORT:-8000}" backend.wsgi:application'
