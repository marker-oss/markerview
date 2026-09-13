# Reviews SaaS deployment

This directory contains deployment-only files for the hosted overlay. They do not modify a VPS by themselves.

## Install

1. Provision PostgreSQL and a `reviews` OS user on the target host.
2. Copy the overlay checkout to `/srv/reviews-saas-src` and copy `env.example` to `/srv/reviews-saas/.env`; fill secrets and `chmod 600`.
3. Create the credentials-key file referenced by `REVIEWS_CREDENTIALS_KEY_FILE` (default `/srv/reviews-saas/.credentials-key`) and back it up separately.
4. Install the service/timer units, run `systemctl daemon-reload`, enable `reviews-saas.service`, `reviews-saas-update.timer`, and `backup.timer`.
5. Run `reviews-saas-src/deploy/saas/deploy.sh` manually once, then verify `/healthz` locally.
6. Apply the SaaS Caddy block from `deploy/Caddyfile` after setting `REVIEWS_SAAS_DOMAIN`.

## Recovery

On a clean machine, install PostgreSQL and create the target database/user. Restore the credential key first, then restore the newest custom-format dump:

```sh
createdb reviews
pg_restore --clean --if-exists -d reviews /srv/backups/reviews-YYYY-MM-DD.dump
```

Copy the environment file and key, run the pinned deploy helper, then start the service:

```sh
systemctl daemon-reload
systemctl enable --now reviews-saas.service
curl --fail http://127.0.0.1:8092/healthz
```

The backup is not a substitute for an off-host copy: sync both dump and credential-key files to protected object storage weekly. Do not run restore against production without an owner-approved maintenance window.

## Robokassa and legacy traffic

Caddy rejects `/billing/result` unless the source IP is `185.59.216.65` or `185.59.217.65`; Robokassa's test/live verification must be performed before enabling real payments. Legacy `reviews.shegida.ru` rewrites are intentionally parameterized with tenant 1's public key at deployment time and are not committed with a real key.
