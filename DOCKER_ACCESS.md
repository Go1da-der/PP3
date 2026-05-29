# Docker Access Notes

Use these URLs after `docker compose up --build -d`:

- App: `http://localhost:3000`
- API docs: `http://localhost:5000/api-docs`
- Database web UI: `http://localhost:8080`

Important:

- `localhost:5432` is the PostgreSQL TCP port, not a web page.
- `localhost:6379` is the Redis TCP port, not a web page.
- Opening those ports in a browser will show an empty page or a protocol error.

Database web UI:

- `pgweb` opens directly on `http://localhost:8080`
- No separate DB login form is required in the browser
- The UI is already connected to `notification_system`

If Docker Desktop still shows old containers or old ports, restart with:

```powershell
docker compose down --remove-orphans
docker compose up --build -d
```
