# Post-event cleanup

1. Set `ALLOW_PUBLIC_REGISTRATION=false` (or remove `EVENT_PUBLIC_DEMO`).
2. Rotate `SECRET_KEY`: `openssl rand -hex 32` → update `.env` → restart API (invalidates sessions).
3. Rotate bootstrap passwords; delete `data/event-bootstrap-passwords.txt`.
4. Revoke provider API keys if used on demo VM.
5. Snapshot then destroy VM or detach public IP.
6. Review audit logs for suspicious registrations; disable/delete demo accounts.
7. Re-run `scan-default-secrets.sh` before archiving disk image.