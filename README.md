# TravelAmigo-SerpApi-Hackathon

## Setup Instructions

### Frontend

1. Install dependencies:

   ```shell
   cd frontend
   npm install
   ```

2. Run the frontend development server:

   ```shell
   npm run dev
   ```

### Backend

1. Install dependencies:

   ```shell
   cd backend
   npm install
   ```

2. Run the backend development server:

   ```shell
   npm run dev
   ```

### Agents

1. Install dependencies using `uv`:

   ```shell
   cd agents
   uv add -r requirements.txt
   ```

2. Run the agents development server:

   ```shell
   uv run uvicorn main:app --reload
   ```
