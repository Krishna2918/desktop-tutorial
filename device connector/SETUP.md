# Universal Device Connector - Setup Guide

## Prerequisites

### Required Software

- **Node.js**: 20.x LTS or higher
- **npm**: 10.x or higher
- **PostgreSQL**: 16 or higher
- **Redis**: 7.x or higher
- **Git**: Latest version

### Platform-Specific Requirements

#### For iOS/macOS Development
- **macOS**: 14.0 (Sonoma) or higher
- **Xcode**: 15.0 or higher
- **Swift**: 5.9 or higher
- **CocoaPods**: Latest version

#### For Android Development
- **Android Studio**: Latest stable version
- **JDK**: 17 or higher
- **Android SDK**: API Level 26 (Android 8.0) or higher
- **Kotlin**: 1.9 or higher

#### For Windows Development
- **Windows**: 10/11
- **Visual Studio Build Tools**: Latest version (for native modules)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "device connector"
```

### 2. Install Dependencies

```bash
# Install root dependencies and all workspace dependencies
npm install
```

This will install dependencies for:
- Root monorepo tools
- Backend service
- Windows app
- Shared types package

### 3. Set Up Environment Variables

#### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

**Minimum required configuration:**
- Database credentials (PostgreSQL)
- Redis connection
- JWT secret
- S3/MinIO credentials

### 4. Set Up Database

```bash
# Create PostgreSQL database
createdb udc_dev

# Run migrations (when available in Phase 2)
npm run migration:run --workspace=backend
```

### 5. Set Up Redis

```bash
# Start Redis (if using Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Or use local Redis installation
redis-server
```

### 6. Set Up MinIO (S3-compatible storage)

```bash
# Using Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"

# Create bucket
# Access MinIO console at http://localhost:9001
# Login with minioadmin/minioadmin
# Create bucket named "udc-files-dev"
```

---

## Development

### Running All Services

```bash
# From root directory - runs backend and windows in parallel
npm run dev
```

### Running Individual Services

#### Backend Only
```bash
npm run dev:backend
# Or
cd backend && npm run dev
```

#### Windows App Only
```bash
npm run dev:windows
# Or
cd windows && npm run dev
```

### Accessing Services

- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health
- **MinIO Console**: http://localhost:9001

---

## Building

### Build All

```bash
npm run build
```

### Build Individual Services

```bash
# Backend
npm run build:backend

# Windows
npm run build:windows
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests for Specific Service

```bash
# Backend
npm run test --workspace=backend

# Windows
npm run test --workspace=windows
```

### Coverage

```bash
npm run test:cov --workspace=backend
```

---

## Linting & Formatting

### Lint All Code

```bash
npm run lint
```

### Format All Code

```bash
npm run format
```

### Type Checking

```bash
npm run type-check
```

---

## Project Structure

```
device connector/
├── backend/              # NestJS backend service
│   ├── src/
│   │   ├── common/       # Shared utilities and services
│   │   ├── config/       # Configuration files
│   │   ├── health/       # Health check module
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── windows/              # Electron + React Windows app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   └── types/            # Shared TypeScript types
│       ├── src/
│       │   ├── user.types.ts
│       │   ├── device.types.ts
│       │   ├── file.types.ts
│       │   ├── session.types.ts
│       │   ├── remote-control.types.ts
│       │   ├── sync.types.ts
│       │   ├── event.types.ts
│       │   ├── api.types.ts
│       │   ├── config.types.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── ios/                  # iOS app (Swift + SwiftUI) - Phase 2+
├── macos/                # macOS app (Swift + SwiftUI) - Phase 2+
├── android/              # Android app (Kotlin + Compose) - Phase 2+
├── design-tokens.json    # Design system tokens
├── package.json          # Root monorepo configuration
├── .gitignore
├── README.md
├── SETUP.md
├── ARCHITECTURE.md
├── DATA_MODELS.md
├── THREAT_MODEL.md
├── TECH_STACK.md
└── PHASE_0_VALIDATION.md
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change PORT in backend/.env
PORT=3001
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Check connection details in backend/.env
# Ensure database exists
psql -l
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules backend/node_modules windows/node_modules shared/types/node_modules
npm install
```

---

## Environment-Specific Setup

### Development
- Uses `.env` file
- Database: `udc_dev`
- Log level: `debug`
- Hot reload enabled

### Staging
- Uses `.env.staging` file
- Database: `udc_staging`
- Log level: `info`
- SSL enabled

### Production
- Uses environment variables (no `.env` file)
- Database: `udc_production`
- Log level: `warn`
- All security features enabled

---

## Docker Setup (Optional)

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: udc_dev
      POSTGRES_USER: udc_user
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
```

---

## Mobile App Setup (Phase 2+)

### iOS Setup

```bash
cd ios
pod install
open UniversalDeviceConnector.xcworkspace
```

### Android Setup

```bash
cd android
./gradlew build
```

---

## CI/CD

GitHub Actions workflows are located in `.github/workflows/`:

- `ci.yml` - Runs on every commit (lint, test, build)
- `deploy-staging.yml` - Deploys to staging on merge to `develop`
- `deploy-production.yml` - Deploys to production on release tags

---

## Next Steps

1. **Phase 1**: Complete foundation setup (current)
2. **Phase 2**: Implement authentication and device management
3. **Phase 3**: Build real-time sync infrastructure
4. **Phase 4**: Add file and clipboard sharing
5. **Phase 5**: Implement remote control features
6. **Phase 6**: Create unified folder explorer UI
7. **Phase 7**: Security hardening and observability
8. **Phase 8**: UX polish and app store packaging

---

## Support

For issues or questions:
- Check documentation in the `/docs` folder
- Review architecture in `ARCHITECTURE.md`
- Check threat model in `THREAT_MODEL.md`
- Review tech stack decisions in `TECH_STACK.md`

---

**Last Updated**: 2025-01-15
**Version**: 0.1.0 (Phase 1)
