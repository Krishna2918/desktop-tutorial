# Deployment Guide

This guide covers deploying Unified AI Hub to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Security](#security)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements (Small Deployments)**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD
- Network: 100 Mbps

**Recommended Requirements (Production)**
- CPU: 4-8 cores
- RAM: 16-32 GB
- Storage: 100 GB SSD (or more depending on data volume)
- Network: 1 Gbps

### Software Requirements

- **Node.js**: v18.x or higher
- **PostgreSQL**: v15.x or higher
- **Qdrant**: Latest version
- **Redis**: v7.x or higher (optional but recommended)
- **Docker**: v24.x or higher (for containerized deployment)
- **Docker Compose**: v2.x or higher
- **Kubernetes**: v1.28+ (for K8s deployment)

## Environment Setup

### 1. Create Environment File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

#### Required Variables

```env
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database
DATABASE_HOST=your-db-host.com
DATABASE_PORT=5432
DATABASE_NAME=unified_ai_prod
DATABASE_USER=unified_ai_user
DATABASE_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
DATABASE_SSL=true

# Qdrant
QDRANT_URL=https://your-qdrant-instance.com:6333
QDRANT_API_KEY=your-qdrant-api-key

# Redis
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD
REDIS_TLS=true

# Security
JWT_SECRET=CHANGE_THIS_LONG_RANDOM_SECRET_KEY_MIN_32_CHARS
JWT_REFRESH_SECRET=CHANGE_THIS_DIFFERENT_LONG_SECRET_KEY
ENCRYPTION_KEY=CHANGE_THIS_EXACTLY_32_CHARS_KEY!

# AI Providers
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Storage
STORAGE_TYPE=s3  # or 'local' for local storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=unified-ai-storage

# Email
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com

# Stripe
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
```

#### Optional Variables

```env
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Session
SESSION_DURATION_MINUTES=15
REFRESH_TOKEN_DURATION_DAYS=7

# Feature Flags
ENABLE_TELEMETRY=true
ENABLE_AUDIT_LOGS=true
ENABLE_WORKFLOWS=true
```

### 3. Generate Secrets

Generate secure random secrets for production:

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (exactly 32 characters)
openssl rand -base64 24

# Refresh Token Secret
openssl rand -base64 48
```

## Database Setup

### 1. PostgreSQL Setup

#### Cloud Providers

**AWS RDS**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier unified-ai-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 100 \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false
```

**Google Cloud SQL**
```bash
gcloud sql instances create unified-ai-prod \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --backup \
  --backup-start-time=03:00
```

#### Self-Hosted

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql-15

# Configure PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE unified_ai_prod;
CREATE USER unified_ai_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE unified_ai_prod TO unified_ai_user;

# Enable required extensions
\c unified_ai_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 2. Run Migrations

```bash
# Install dependencies
npm ci --production

# Run database migrations
npm run migrate

# Verify migration
npm run migrate:status
```

### 3. Seed Initial Data (Optional)

```bash
# Create admin user
npm run seed:admin

# Load default configurations
npm run seed:config
```

## Application Deployment

### Method 1: PM2 (Process Manager)

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Start with PM2**
   ```bash
   # Start application
   pm2 start ecosystem.config.js --env production

   # Save PM2 configuration
   pm2 save

   # Setup PM2 to start on boot
   pm2 startup
   ```

4. **PM2 Configuration** (`ecosystem.config.js`)
   ```javascript
   module.exports = {
     apps: [{
       name: 'unified-ai-hub',
       script: './dist/backend/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env_production: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       merge_logs: true,
       max_memory_restart: '1G',
       autorestart: true,
       watch: false
     }]
   };
   ```

### Method 2: Systemd Service

1. **Create Service File** (`/etc/systemd/system/unified-ai.service`)
   ```ini
   [Unit]
   Description=Unified AI Hub
   After=network.target postgresql.service

   [Service]
   Type=simple
   User=nodejs
   WorkingDirectory=/opt/unified-ai-hub
   Environment=NODE_ENV=production
   EnvironmentFile=/opt/unified-ai-hub/.env
   ExecStart=/usr/bin/node /opt/unified-ai-hub/dist/backend/index.js
   Restart=always
   RestartSec=10
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=unified-ai

   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable unified-ai
   sudo systemctl start unified-ai
   sudo systemctl status unified-ai
   ```

## Docker Deployment

### 1. Single Server Deployment

```bash
# Clone repository
git clone https://github.com/yourusername/unified-ai-hub.git
cd unified-ai-hub/Unified\ AI

# Configure environment
cp .env.example .env
# Edit .env with production values

# Build and start services
docker-compose -f docker-compose.yml --profile production up -d

# View logs
docker-compose logs -f backend

# Check health
curl http://localhost:3000/health
```

### 2. Multi-Server Deployment

For distributed deployments:

1. **Database Server**
   ```bash
   docker-compose up -d postgres
   ```

2. **Cache Server**
   ```bash
   docker-compose up -d redis
   ```

3. **Vector DB Server**
   ```bash
   docker-compose up -d qdrant
   ```

4. **Application Servers** (multiple instances)
   ```bash
   docker-compose up -d backend
   # Use load balancer to distribute traffic
   ```

## Kubernetes Deployment

### 1. Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or self-hosted)
- kubectl configured
- Helm 3.x installed

### 2. Create Namespace

```bash
kubectl create namespace unified-ai
```

### 3. Create Secrets

```bash
# Database credentials
kubectl create secret generic db-credentials \
  --from-literal=username=unified_ai_user \
  --from-literal=password=YOUR_DB_PASSWORD \
  -n unified-ai

# JWT secrets
kubectl create secret generic jwt-secrets \
  --from-literal=jwt-secret=YOUR_JWT_SECRET \
  --from-literal=refresh-secret=YOUR_REFRESH_SECRET \
  -n unified-ai

# AI Provider API keys
kubectl create secret generic ai-api-keys \
  --from-literal=openai-key=YOUR_OPENAI_KEY \
  --from-literal=anthropic-key=YOUR_ANTHROPIC_KEY \
  --from-literal=google-key=YOUR_GOOGLE_KEY \
  -n unified-ai
```

### 4. Deploy with Helm

```bash
# Add Helm repository
helm repo add unified-ai https://charts.unified-ai-hub.com

# Install chart
helm install unified-ai unified-ai/unified-ai-hub \
  --namespace unified-ai \
  --values values-production.yaml
```

### 5. Example Kubernetes Manifests

**Deployment** (`k8s/deployment.yaml`)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-ai-backend
  namespace: unified-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: unified-ai-backend
  template:
    metadata:
      labels:
        app: unified-ai-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/yourusername/unified-ai-hub:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

**Service** (`k8s/service.yaml`)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: unified-ai-backend
  namespace: unified-ai
spec:
  selector:
    app: unified-ai-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

**Ingress** (`k8s/ingress.yaml`)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: unified-ai-ingress
  namespace: unified-ai
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: unified-ai-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: unified-ai-backend
            port:
              number: 80
```

## Scaling

### Horizontal Scaling

**Docker Compose**
```bash
docker-compose up -d --scale backend=5
```

**Kubernetes**
```bash
kubectl scale deployment unified-ai-backend --replicas=10 -n unified-ai
```

**Auto-scaling (Kubernetes)**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: unified-ai-backend-hpa
  namespace: unified-ai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: unified-ai-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Scaling

Increase resources for existing instances:

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

### Database Scaling

**Read Replicas**
- Configure read replicas for PostgreSQL
- Use connection pooling (PgBouncer)
- Implement caching layer with Redis

**Partitioning**
- Partition large tables by date
- Use table inheritance for multi-tenancy

## Monitoring

### 1. Application Monitoring

**Prometheus & Grafana**

```bash
# Start monitoring stack
docker-compose --profile monitoring up -d

# Access Grafana
open http://localhost:3001
# Login: admin / admin
```

**Metrics Endpoint**
```bash
curl http://localhost:3000/metrics
```

### 2. Log Aggregation

**ELK Stack**
```bash
# Configure Filebeat to ship logs
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/unified-ai/*.log
  json.keys_under_root: true
```

**CloudWatch (AWS)**
```bash
# Configure CloudWatch agent
aws logs create-log-group --log-group-name /unified-ai/production
```

### 3. Error Tracking

**Sentry Integration**
```env
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
```

### 4. Health Checks

```bash
# Application health
curl https://api.yourdomain.com/health

# Database connectivity
curl https://api.yourdomain.com/health/db

# Dependencies
curl https://api.yourdomain.com/health/dependencies
```

## Security

### SSL/TLS Configuration

**Let's Encrypt (Certbot)**
```bash
certbot --nginx -d api.yourdomain.com
```

**Kubernetes (cert-manager)**
```bash
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

### Firewall Rules

```bash
# Allow HTTPS
sudo ufw allow 443/tcp

# Allow SSH (specific IP)
sudo ufw allow from YOUR_IP to any port 22

# Enable firewall
sudo ufw enable
```

### Security Headers

Configure in Nginx or application:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Backup & Recovery

### Database Backups

**Automated Backups**
```bash
# Create backup script
cat > /opt/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d unified_ai_prod > $BACKUP_DIR/backup_$DATE.sql
# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.sql s3://your-backup-bucket/
EOF

chmod +x /opt/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
0 2 * * * /opt/scripts/backup-db.sh
```

### Application Data Backup

```bash
# Backup uploads and storage
tar -czf storage-backup-$(date +%Y%m%d).tar.gz /app/storage
aws s3 cp storage-backup-*.tar.gz s3://your-backup-bucket/storage/
```

### Disaster Recovery

1. **Database Restore**
   ```bash
   psql -h $DB_HOST -U $DB_USER -d unified_ai_prod < backup_20240101_020000.sql
   ```

2. **Application Restore**
   ```bash
   # Pull latest image
   docker pull ghcr.io/yourusername/unified-ai-hub:latest

   # Restart services
   docker-compose up -d
   ```

## Troubleshooting

### Common Issues

**1. Database Connection Issues**
```bash
# Check connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check logs
docker-compose logs postgres
```

**2. High Memory Usage**
```bash
# Check Node.js heap usage
curl http://localhost:3000/metrics | grep nodejs_heap

# Adjust Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" node dist/backend/index.js
```

**3. Slow Response Times**
```bash
# Check Redis connection
redis-cli -h $REDIS_HOST ping

# Clear cache
redis-cli FLUSHALL
```

**4. Failed Migrations**
```bash
# Rollback migration
npm run migrate:revert

# Check migration status
npm run migrate:status

# Manually fix database, then re-run
npm run migrate
```

### Performance Tuning

**PostgreSQL**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM messages WHERE userId = '...';

-- Create indexes
CREATE INDEX idx_messages_user_timestamp ON messages(userId, timestamp DESC);

-- Update statistics
ANALYZE messages;
```

**Node.js**
```javascript
// Enable cluster mode
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start app
}
```

## Additional Resources

- [Architecture Documentation](./architecture/README.md)
- [API Reference](./API_REFERENCE.md)
- [Security Best Practices](./SECURITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

## Support

For deployment assistance:
- Email: devops@unified-ai-hub.com
- Slack: #deployment-help
- Enterprise Support: enterprise@unified-ai-hub.com
