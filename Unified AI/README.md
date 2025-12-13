# Unified AI Hub

> A comprehensive, multi-provider AI platform with advanced orchestration, privacy controls, and enterprise features.

## Overview

Unified AI Hub is a production-ready platform that provides a unified interface to multiple AI providers (OpenAI, Anthropic, Google, Meta) with advanced features including:

- **Multi-Provider Support**: Seamlessly switch between OpenAI, Anthropic, Google, and Meta AI models
- **Advanced Orchestration**: Multi-step AI workflows with conditional logic and parallel execution
- **Privacy-First**: GDPR-compliant data handling with granular privacy controls
- **Enterprise Ready**: Audit logs, RBAC, SSO, and compliance features
- **Collaborative**: Team workspaces with real-time collaboration
- **Secure**: End-to-end encryption, data retention policies, and advanced security features

## Features

### Core Features
- ✅ Multi-provider AI integration (OpenAI, Anthropic, Google, Meta)
- ✅ Conversation management with context preservation
- ✅ Document upload and processing
- ✅ File attachments with multiple storage backends
- ✅ Advanced search with semantic similarity
- ✅ Real-time streaming responses

### Advanced Features
- ✅ **Workflow Orchestration**: Create complex AI workflows with multiple steps
- ✅ **Team Collaboration**: Shared workspaces, projects, and conversations
- ✅ **Role-Based Access Control**: Fine-grained permissions and organization management
- ✅ **Privacy Controls**: Per-provider data sharing policies and GDPR compliance
- ✅ **Audit Logging**: Comprehensive audit trail for compliance and security
- ✅ **Subscription Management**: Multiple pricing tiers with Stripe integration
- ✅ **Telemetry**: Privacy-respecting analytics and usage tracking

### UI/UX
- ✅ Dynamic theming (light, dark, high-contrast)
- ✅ Configurable layouts and workspaces
- ✅ Command palette for quick actions
- ✅ Keyboard shortcuts
- ✅ Accessibility features

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Qdrant (vector database)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/unified-ai-hub.git
   cd unified-ai-hub/Unified\ AI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services with Docker Compose**
   ```bash
   docker-compose up -d postgres qdrant redis
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`.

### Docker Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down
```

## Architecture

### Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (relational data)
- **Vector DB**: Qdrant (semantic search)
- **Cache**: Redis (session and response caching)
- **ORM**: TypeORM
- **Authentication**: JWT with refresh tokens
- **Storage**: Local filesystem or S3-compatible storage

### Project Structure

```
Unified AI/
├── backend/
│   ├── adapters/         # AI provider adapters
│   ├── config/           # Database and service configuration
│   ├── entities/         # TypeORM entities
│   ├── services/         # Business logic
│   │   ├── auth.service.ts
│   │   ├── conversation.service.ts
│   │   ├── orchestrator.service.ts
│   │   ├── audit.service.ts
│   │   ├── privacy.service.ts
│   │   ├── subscription.service.ts
│   │   └── ...
│   ├── utils/            # Utilities
│   └── tests/            # Test files
├── config/               # Configuration files
│   ├── providers.config.json
│   ├── themes.config.json
│   ├── ui.config.json
│   └── features.config.json
├── docs/                 # Documentation
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yml    # Docker services
├── Dockerfile           # Container image
└── package.json
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=unified_ai
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Qdrant
QDRANT_URL=http://localhost:6333

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Stripe (optional)
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Provider Configuration

Edit `/home/user/desktop-tutorial/Unified AI/config/providers.config.json` to configure AI providers, models, and rate limits.

### Feature Flags

Edit `/home/user/desktop-tutorial/Unified AI/config/features.config.json` to control feature availability per subscription tier.

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

### Linting and Type Checking

```bash
# Run ESLint
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run typecheck
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migrate

# Revert migration
npm run migrate:revert
```

## API Documentation

### Authentication

```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "displayName": "John Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

### Conversations

```bash
# Create conversation
POST /api/conversations
{
  "sessionId": "session-uuid",
  "provider": "openai",
  "model": "gpt-4"
}

# Send message
POST /api/conversations/:id/messages
{
  "content": "Hello, AI!",
  "role": "user"
}
```

### Workflows

```bash
# Create workflow
POST /api/workflows
{
  "name": "Research Assistant",
  "steps": [...]
}

# Execute workflow
POST /api/workflows/:id/execute
{
  "input": { "topic": "AI Ethics" }
}
```

For complete API documentation, see [API Reference](docs/API_REFERENCE.md).

## Deployment

### Production Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions including:

- Environment setup
- Database configuration
- Scaling strategies
- Monitoring and logging
- Security best practices

### Docker Deployment

```bash
# Build production image
docker build -t unified-ai-hub:latest .

# Run with docker-compose
docker-compose -f docker-compose.yml --profile production up -d
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n unified-ai
```

## Monitoring

### Health Check

```bash
GET /health
```

### Metrics

- Prometheus metrics at `/metrics`
- Grafana dashboards included in `monitoring/grafana/dashboards/`

## Security

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens with short expiry (15 minutes) and refresh tokens
- API keys encrypted at rest
- HTTPS required in production
- Rate limiting on all endpoints
- SQL injection protection via TypeORM
- XSS protection with input sanitization
- CSRF protection for state-changing operations

## Privacy & Compliance

- **GDPR Compliant**: Right to access, right to erasure, data portability
- **Audit Logs**: Complete audit trail for all user actions
- **Data Retention**: Configurable retention policies per provider
- **Privacy Controls**: Granular data sharing controls
- **Anonymization**: Telemetry data anonymized by default

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/yourusername/unified-ai-hub/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/unified-ai-hub/discussions)
- Email: support@unified-ai-hub.com

## Roadmap

- [ ] Real-time collaboration features
- [ ] Voice input/output support
- [ ] Mobile applications (iOS/Android)
- [ ] Plugin system for custom integrations
- [ ] Self-hosted model support (Llama, Mistral)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support

## Acknowledgments

- OpenAI for GPT models
- Anthropic for Claude models
- Google for Gemini models
- Meta for Llama models
- All open-source contributors

---

**Built with ❤️ by the Unified AI Hub Team**
