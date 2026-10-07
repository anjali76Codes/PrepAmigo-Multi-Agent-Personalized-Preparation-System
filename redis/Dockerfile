FROM redis:alpine

EXPOSE 6379

CMD ["sh", "-c", "if [ -z \"$REDIS_PASSWORD\" ]; then echo 'REDIS_PASSWORD is required' >&2; exit 1; fi; exec redis-server --bind 0.0.0.0 --protected-mode yes --requirepass \"$REDIS_PASSWORD\" --appendonly yes --dir /data"]
