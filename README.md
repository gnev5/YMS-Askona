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
