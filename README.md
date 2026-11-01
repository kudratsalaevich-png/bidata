# BIData Web

BIData analytics web application, version 10.3. The FastAPI entry point is `app.py`; the active browser client and assets are in `static/`.

## Data and secrets

Live UZBI databases and the web login database are intentionally kept outside Git. The app reads market data from `UZBI_ROOT/data` by default; set `UZBI_ROOT` to the server's mounted data directory. Optional per-database overrides use `UZBI_DB_<NAME>`. Keep the web login/session store at a persistent private path with `UZBI_APP_DB`. Never commit `.env`, SQLite files, backups, logs, or virtual environments.

The app creates its first `admin` account only when `UZBI_ADMIN_PASSWORD` is set in a private environment file. There is no default password. Preserve the existing `uzbi_web_app.sqlite3` when deploying updates.

## Local Windows setup

1. Install Python and run `INSTALL_WINDOWS.bat`.
2. Copy `.env.example` to `.env`, set `UZBI_ROOT` and (only for a new login database) a strong `UZBI_ADMIN_PASSWORD`.
3. Run `START_UZBI_WEB.bat`.

## Linux service template

`deploy/bidata-web.service` runs Uvicorn on loopback port 8090 behind Nginx. Configure `/etc/bidata/bidata.env` with the live database locations and secure cookie setting, keep it out of Git, and ensure the service account can read the market databases and write only to the separate app-state directory. `deploy/nginx_bidata.conf` is an HTTP reverse-proxy template; configure TLS on the server before public use.

## Deployment updates

GitHub Actions deployment is gated by the repository variable `BIDATA_DEPLOY_ENABLED=true`. Configure `BIDATA_DATA_DIR` plus the SSH secrets only after the server path, database mount, and existing live site have been reviewed. The deployment regenerates `static/product-ticker-data.json` from that server-side database directory; this generated market data file is ignored by Git and is never uploaded to GitHub.
