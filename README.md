## YMS (Backend + Frontend)

### Start all services
```bash
docker compose up --build -d
```

### Seed database
```bash
docker compose exec backend python -m app.seed
```

### URLs
- Frontend: http://localhost:5173
- API Swagger: http://localhost:8000/docs

### Auth (backend)
- Login: `POST /auth/login` (username=email, password)
- Default admin: `admin@yms.local` / `Admin1234!`

### Frontend
- React (Vite). Login формирует Bearer-токен, календарь читает `/api/time-slots`.
- Для записи будет использоваться модалка (следующий шаг) и `POST /api/bookings`.

### Backend endpoints (основные)
- Docks: `GET/POST /api/docks/`, `GET/PUT/DELETE /api/docks/{id}`
- Vehicle Types: `GET/POST /api/vehicle-types/`, `GET/PUT/DELETE /api/vehicle-types/{id}`
- Work Schedules: `GET/POST/PUT/DELETE /api/work-schedules`
- Generate Time Slots: `POST /api/work-schedules/generate-time-slots`
- Time Slots: `GET /api/time-slots?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`
- Bookings: `POST /api/bookings`, `DELETE /api/bookings`

### Environment
The backend uses these env vars (inlined in compose):
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `JWT_SECRET` (optional, defaults to dev value), `JWT_EXPIRE_MINUTES` (default 60)

### Notes
- Tables are auto-created on startup for development. Consider Alembic for migrations.

### Test environment on the shared server

The test environment is isolated from production by a separate Compose project, container names, ports, and Postgres volume.

Default test URLs:
- Frontend: `http://158.160.94.205:15173`
- API Swagger: `http://158.160.94.205:18000/docs`
- API health: `http://158.160.94.205:18000/health`

Server-side layout:

```bash
mkdir -p /home/gnev5hermes/yms-askona-test/backups
cp docker-compose.test.yml /home/gnev5hermes/yms-askona-test/docker-compose.test.yml
cp .env.test.example /home/gnev5hermes/yms-askona-test/.env.test
```

Before the first launch, edit `/home/gnev5hermes/yms-askona-test/.env.test` and generate real values for:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`

Never commit the real `.env.test` file.

Render and start the test stack:

```bash
cd /home/gnev5hermes/yms-askona-test
docker compose --env-file .env.test -f docker-compose.test.yml config
docker compose --env-file .env.test -f docker-compose.test.yml up -d
```

Verify:

```bash
docker compose --env-file .env.test -f docker-compose.test.yml ps
curl -fsS http://127.0.0.1:18000/health
curl -fsSI http://127.0.0.1:15173/
```

The test database is internal to Docker and is not published on a host port. Production containers and the production volume are not reused.

### GitHub Actions test deploy

Workflow: `.github/workflows/test-environment.yml`.

Required repository secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `YMS_TEST_HOST`
- `YMS_TEST_USER`
- `YMS_TEST_SSH_KEY`
- optional `YMS_TEST_SSH_PORT`

The workflow builds and pushes:
- `vallabe/ymsaskona-backend:test-latest`
- `vallabe/ymsaskona-backend:test-<sha>`
- `vallabe/ymsaskona-frontend:test-latest`
- `vallabe/ymsaskona-frontend:test-<sha>`

Deploy runs automatically on pushes to the `test` branch, or manually through `workflow_dispatch` when `deploy=true`.

