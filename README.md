# Nexus - Client Portal & Project Dashboard

A professional, full-stack client management and project tracking application built with **FastAPI** and **React**. Features a stunning dark-themed UI with smooth animations, real-time analytics, and comprehensive business management tools.

## Screenshots

![Dashboard Overview](screenshots/Screenshot%20from%202026-01-04%2021-50-33.png)
![Projects View](screenshots/Screenshot%20from%202026-01-04%2021-51-29.png)
![Project Detail](screenshots/Screenshot%20from%202026-01-04%2021-51-36.png)
![Clients](screenshots/Screenshot%20from%202026-01-04%2021-51-40.png)
![Invoices](screenshots/Screenshot%20from%202026-01-04%2021-51-47.png)
![Invoice Form](screenshots/Screenshot%20from%202026-01-04%2021-51-56.png)
![Tasks Board](screenshots/Screenshot%20from%202026-01-04%2021-52-05.png)

---

## Features

- **Authentication System** - JWT-based secure authentication with login/register 
- **Dashboard Analytics** - Revenue charts, project status distribution, activity timeline
- **Project Management** - Create, track, and manage projects with progress tracking
- **Client Management** - Comprehensive client database with contact details
- **Invoice Tracking** - Create invoices, track payments, manage billing
- **Dark/Light Mode** - Beautiful theme switcher with system preference support
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Docker Ready** - Full Docker and Docker Compose support

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database (easy to switch to PostgreSQL)
- **JWT** - Secure token-based authentication
- **Pydantic** - Data validation using Python type hints

### Frontend
- **React 18** - UI library with hooks
- **React Router v6** - Client-side routing
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Production web server

## Project Structure

```
client-portal/
├── backend/
│   ├── main.py          # FastAPI app & routes
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── auth.py          # Authentication logic
│   ├── database.py      # Database configuration
│   ├── config.py        # App settings (env-based)
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Backend container
│
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React context providers
│   │   ├── styles/      # CSS styles
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # Entry point
│   ├── nginx.conf       # Nginx configuration
│   ├── Dockerfile       # Production container
│   └── Dockerfile.dev   # Development container
│
├── docker-compose.yml     # Production compose
├── docker-compose.dev.yml # Development compose
└── .env.example           # Environment template
```

---

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Production Mode

```bash
# Clone and navigate to the project
cd client-portal

# Copy environment file and customize
cp .env.example .env

# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f
```

The app will be available at:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Development Mode (with hot reloading)

```bash
# Start development containers
docker-compose -f docker-compose.dev.yml up -d --build

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000

### Docker Commands

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v

# Rebuild specific service
docker-compose up -d --build backend

# View container status
docker-compose ps

# Execute command in container
docker-compose exec backend python -c "print('Hello')"
```

---

## Manual Setup (Without Docker)

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
# Navigate to backend directory
cd client-portal/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd client-portal/frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (change in production!) | `your-super-secret...` |
| `DEBUG` | Enable debug mode | `false` |
| `DATABASE_URL` | Database connection string | `sqlite:///./data/portal.db` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost,...` |

### Generate a secure secret key:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List all clients |
| POST | `/api/clients` | Create client |
| GET | `/api/clients/{id}` | Get client |
| PUT | `/api/clients/{id}` | Update client |
| DELETE | `/api/clients/{id}` | Delete client |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices |
| POST | `/api/invoices` | Create invoice |
| PUT | `/api/invoices/{id}` | Update invoice |
| DELETE | `/api/invoices/{id}` | Delete invoice |

### Dashboard & Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Get dashboard statistics |
| POST | `/api/seed` | Seed demo data |
| GET | `/api/health` | Health check |

---

## Design Highlights

- **"Neo-Corporate Luxury"** aesthetic with dark theme
- **Outfit** font for headings, **DM Sans** for body text
- Emerald green accent color (#10B981)
- Glassmorphism card effects
- Smooth page transitions with Framer Motion
- Custom scrollbars
- Responsive grid layouts

---

## Customization

### Change Theme Colors
Edit CSS variables in `frontend/src/styles/index.css`:

```css
:root {
  --accent-primary: #10B981;    /* Main accent */
  --accent-secondary: #6366F1;  /* Secondary accent */
  --bg-primary: #0A0A0F;        /* Background */
}
```

### Use PostgreSQL
Update your `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/nexus_portal
```

Add `psycopg2-binary` to `backend/requirements.txt`:
```
psycopg2-binary==2.9.9
```

---

## Deployment Tips

### Production Checklist

1. **Change SECRET_KEY** - Use a strong, random key
2. **Set DEBUG=false** - Disable debug mode
3. **Use HTTPS** - Add SSL/TLS certificates
4. **Configure CORS** - Set specific allowed origins
5. **Use PostgreSQL** - For production workloads
6. **Add rate limiting** - Protect against abuse
7. **Set up backups** - Regular database backups

### Deploy to Cloud

The Docker setup works with:
- **AWS ECS / Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**
- **Railway / Render / Fly.io**

---

## License

MIT License - feel free to use this for your portfolio or client projects!

---

**Built with FastAPI + React + Docker** | Perfect for Upwork Portfolio
