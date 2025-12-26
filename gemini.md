# Gemini Project: YMS Askona

This file provides an overview of the YMS Askona project and instructions for developers working with the Gemini CLI.

## 1. Project Overview

YMS (Yard Management System) Askona is a web application designed to manage logistics and scheduling for a delivery yard. It includes features for booking time slots, managing docks, suppliers, and transport types.

-   **Backend**: Python (FastAPI) with a PostgreSQL database.
-   **Frontend**: React (TypeScript) with Vite.
-   **Containerization**: Docker and Docker Compose.

## 2. Development Environment Setup

To set up the development environment, follow these steps:

### 2.1. Prerequisites

-   Docker and Docker Compose
-   Python 3.9+
-   Node.js and npm

### 2.2. Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### 2.3. Frontend Setup

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## 3. Running the Application

### 3.1. Using Docker Compose (Recommended)

The easiest way to run the entire application stack is with Docker Compose.

1.  From the project root, build and start the services:
    ```bash
    docker-compose up --build
    ```
2.  The application will be available at `http://localhost:5173`.

### 3.2. Running Services Manually

#### Backend

1.  Make sure the PostgreSQL database is running (e.g., via Docker).
2.  From the `backend` directory, run the FastAPI server:
    ```bash
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

#### Frontend

1.  From the `frontend` directory, start the Vite development server:
    ```bash
    npm run dev
    ```

## 4. Key API Endpoints

The backend API is served at `/api`.

-   `GET /api/bookings/`: Get all bookings.
-   `POST /api/bookings/`: Create a new booking.
-   `GET /api/objects/`: Get all objects (e.g., warehouses).
-   `GET /api/docks/`: Get all docks.
-   `GET /api/time_slots/`: Get available time slots.

Refer to the code in `backend/app/routers/` for a full list of endpoints.

## 5. Coding Conventions

-   **Python**: Follow PEP 8 guidelines. Use `black` for formatting.
-   **TypeScript/React**: Follow standard community practices. Use Prettier for formatting.

## 6. Взаимодействие с пользователем

- Давай ответы пользователю на русском языке

