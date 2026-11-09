# Edge CDN, Brotli, and static caching (Q-TeleScope)

App ships **GZip** on API responses (`GZipMiddleware`). UI static assets come from Vite build — tune at reverse proxy / CDN.

## Recommended nginx snippet

```nginx
# API upstream
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header X-Forwarded-Proto $scheme;
    brotli off;   # API JSON — gzip from app is enough; optional brotli on proxy
}

# Vite / static UI
location / {
    root /var/www/qtelescope/dist;
    try_files $uri $uri/ /index.html;
    brotli on;
    brotli_types text/css application/javascript application/json image/svg+xml;
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable" for /assets/*;
}
```

## CDN

- Publish `frontend/dist/assets/*` with **content-hash** filenames (Vite default) — long cache OK.
- Keep `index.html` **short TTL** (60s–5m) so deploys propagate.
- Do not put API keys or session tokens on CDN — API stays origin-only.

## Monitoring

- Use `Server-Timing: app;dur=…` from API + `SLOW_REQUEST_MS` logs for superadmin triage.
- Full RUM (web-vitals) — future superadmin panel; not bundled in SPA yet.
