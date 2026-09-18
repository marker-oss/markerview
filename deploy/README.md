# Deploy with Docker Compose

Docker Compose is the supported self-hosted deployment path. The current
Compose file builds the image from a source checkout; it does not pull a
published registry image.

## Prerequisites

- A Linux host with Docker and the Compose plugin.
- A persistent backup destination outside the Docker host/volumes.
- For production, a domain such as `reviews.myshop.example` with an A record
  pointing to the server, and inbound ports 80/443 for a reverse proxy.
- The shop origin, such as `https://myshop.example`, for CORS and product links.
- Credentials for the marketplaces you enable. Keep them out of Git and public
  logs. Wildberries requires a personal token for reviews/questions; Yandex
  Market requires Business ID plus Api-Key or OAuth; Ozon requires Client-Id
  and Api-Key and is disabled by default. Ozon review access requires Premium
  Plus and the `Reviews` role; also grant `Products` so reviews can be mapped by
  `offer_id`, and optionally `Questions`.

The [user guide](../docs/user-guide.md#docker-подготовка-к-запуску) has detailed
token and marketplace requirements.

## Start the service

```sh
git clone https://github.com/marker-oss/markerview.git reviews
cd reviews
cp .env.example .env
# Edit .env before continuing.
docker compose up -d --build
curl --fail http://127.0.0.1:8080/healthz
```

At minimum, configure the shop origin and only the marketplaces whose
credentials are present. The service runs migrations on startup and its default
command, `serve --with-sync`, runs periodic review sync in the same container.

`.env.example` enables `REVIEWS_INSECURE_COOKIES=1` for local HTTP preview. In
production behind HTTPS, remove that value or leave it empty so admin session
cookies remain `Secure`. `docker compose config` expands `.env`; do not paste
its output into tickets or logs when it contains real credentials.

The application listens on `127.0.0.1:8080` on the host. Open
`http://127.0.0.1:8080/admin` locally to create the first administrator. For a
remote production host, complete HTTPS setup first and use
`https://reviews.myshop.example/admin`.

## DNS and HTTPS

Point `reviews.myshop.example` to the server before starting Caddy. A minimal
`/etc/caddy/Caddyfile` for the Compose service is:

```caddyfile
reviews.myshop.example {
    reverse_proxy 127.0.0.1:8080
}
```

After saving it, run `sudo systemctl reload caddy`.

Caddy requests and renews the TLS certificate automatically. Keep application
port 8080 bound to loopback; expose only the reverse proxy on 80/443. Set
`REVIEWS_PUBLIC_DOMAIN=reviews.myshop.example` and
`REVIEWS_SHOP_ORIGIN=https://myshop.example` in the application `.env`.

## Operations

```sh
docker compose logs -f reviews
docker compose restart reviews
docker compose run --rm reviews sync --once
docker compose down            # named volumes are preserved
```

Do not use `docker compose down -v` unless you intentionally want to delete
application data. SQLite, uploaded media and product links live in the
`reviews-data` volume; published widget data lives in `reviews-exports`.
Back up all of them. The complete backup and restore contract is documented in
[operations and security](../docs/technical/operations-and-security.md#backup-и-restore).

To update the source-built deployment:

```sh
git pull
docker compose up -d --build
curl --fail http://127.0.0.1:8080/healthz
```

The supplied `auto-update.sh` pulls a configured remote image. It does not
update this source-build Compose deployment; use the commands above.

## Yandex Tag Manager

After deployment, open **Admin → Embed** and copy the generated snippet. Add it
as a Custom HTML tag firing on DOM Ready / all pages, connect the Tag Manager
container to the shop, and publish a container version. Saving the tag without
publishing does not put it on the site. The widget and its assets must use the
HTTPS reviews domain to avoid mixed-content blocking.
