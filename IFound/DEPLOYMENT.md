# I Found!! - Production Deployment Guide

This guide covers deploying the I Found!! platform to a production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Docker Deployment](#docker-deployment)
6. [Manual Deployment](#manual-deployment)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or later (recommended)
- **RAM**: Minimum 4GB (8GB+ recommended)
- **Storage**: 50GB+ SSD
- **CPU**: 2+ cores recommended
- **Network**: Static IP address, open ports 80/443

### Software Requirements
- Docker & Docker Compose (>= 20.10)
- Node.js >= 18.x (for manual deployment)
- PostgreSQL >= 14 (for manual deployment)
- Redis >= 7 (for manual deployment)
- Nginx (for reverse proxy)

---

## Server Setup

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
```

### 3. Install Required Tools
```bash
sudo apt install -y git curl wget nginx certbot python3-certbot-nginx
```

### 4. Firewall Configuration
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## Database Setup

### Option 1: Docker (Recommended)
Database will be automatically set up via docker-compose.

### Option 2: Manual Setup
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql

CREATE DATABASE ifound_production;
CREATE USER ifound WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ifound_production TO ifound;
\q

# Install Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
```

---

## Environment Configuration

### 1. Clone Repository
```bash
cd /var/www
git clone https://github.com/yourusername/ifound.git
cd ifound
```

### 2. Configure Backend Environment
```bash
cd backend
cp .env.production.example .env.production

# Edit production environment
nano .env.production
```

**Critical Variables to Change:**
```env
# Database
DATABASE_URL=postgresql://ifound:your_password@localhost:5432/ifound_production

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_generated_secret_here
JWT_REFRESH_SECRET=your_generated_refresh_secret_here

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Email SMTP
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password

# AWS S3 (if using cloud storage)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=ifound-production-uploads
```

### 3. Configure Admin Dashboard
```bash
cd ../frontend-admin
echo "VITE_API_URL=https://api.yourdomain.com/api/v1" > .env.production
```

---

## Docker Deployment

### 1. Set Environment Variables
```bash
cd /var/www/ifound

# Create .env for docker-compose
cat > .env << 'EOF'
POSTGRES_USER=ifound
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=ifound_production
REDIS_PASSWORD=your_secure_redis_password
API_URL=https://api.yourdomain.com/api/v1
EOF
```

### 2. Build and Start Services
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Run Database Migrations
```bash
docker-compose -f docker-compose.prod.yml exec backend npm run migrate
```

### 4. Create Admin User
```bash
docker-compose -f docker-compose.prod.yml exec backend node scripts/create-admin.js
```

---

## Manual Deployment

### 1. Install Dependencies
```bash
# Backend
cd backend
npm ci --production
node scripts/download-ai-models.js

# Admin Dashboard
cd ../frontend-admin
npm ci
npm run build
```

### 2. Setup Process Manager (PM2)
```bash
npm install -g pm2

# Start backend
cd backend
pm2 start src/server.js --name ifound-api

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. Serve Admin Dashboard
```bash
sudo cp -r frontend-admin/dist /var/www/admin
sudo chown -R www-data:www-data /var/www/admin
```

---

## SSL/TLS Setup

### Using Let's Encrypt (Free SSL)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificates
sudo certbot --nginx -d api.yourdomain.com
sudo certbot --nginx -d admin.yourdomain.com
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Manual SSL Setup
```bash
# Place your SSL certificates
sudo mkdir -p /etc/nginx/ssl
sudo cp your_cert.pem /etc/nginx/ssl/cert.pem
sudo cp your_key.pem /etc/nginx/ssl/key.pem
sudo chmod 600 /etc/nginx/ssl/*.pem
```

---

## Monitoring & Logging

### 1. Application Logs
```bash
# Docker logs
docker-compose logs -f backend

# Manual deployment logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### 2. Health Checks
```bash
# API health
curl https://api.yourdomain.com/health

# Metrics
curl https://api.yourdomain.com/metrics
```

### 3. Set Up Monitoring (Optional)
```bash
# Install Node Exporter for Prometheus
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/
```

### 4. Log Rotation
```bash
# Create logrotate config
sudo nano /etc/logrotate.d/ifound

# Add configuration:
/var/www/ifound/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## Backup & Recovery

### 1. Database Backup Script
```bash
#!/bin/bash
# /var/www/ifound/scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/ifound"

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U ifound ifound_production > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

### 2. Schedule Backups
```bash
# Make script executable
chmod +x /var/www/ifound/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * /var/www/ifound/scripts/backup-db.sh
```

### 3. Backup Uploads
```bash
# Sync uploads to S3 or backup location
aws s3 sync /var/www/ifound/backend/uploads s3://your-backup-bucket/uploads

# Or use rsync
rsync -avz /var/www/ifound/backend/uploads user@backup-server:/backups/ifound/
```

### 4. Database Restore
```bash
# Stop application
docker-compose down

# Restore database
gunzip < /var/backups/ifound/db_20231201_020000.sql.gz | \
  docker-compose exec -T postgres psql -U ifound ifound_production

# Restart
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check database is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U ifound -d ifound_production
```

#### 2. High Memory Usage
```bash
# Check memory
free -h

# Check container resources
docker stats

# Restart backend
docker-compose restart backend
```

#### 3. AI Models Not Loading
```bash
# Download models manually
docker-compose exec backend npm run setup-ai

# Check models directory
docker-compose exec backend ls -la ai-models/
```

#### 4. SSL Certificate Issues
```bash
# Renew certificates
sudo certbot renew --force-renewal

# Test SSL
openssl s_client -connect api.yourdomain.com:443
```

### Logs to Check
```bash
# Application logs
tail -f backend/logs/error.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# System logs
sudo journalctl -u docker -f
```

### Performance Tuning

#### PostgreSQL
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### Node.js
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong JWT secrets
- [ ] Configured HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Enabled rate limiting
- [ ] Configured CORS properly
- [ ] Set secure cookie flags
- [ ] Disabled debug mode
- [ ] Set up automated backups
- [ ] Configured log rotation
- [ ] Enabled security headers
- [ ] Updated all dependencies
- [ ] Reviewed environment variables
- [ ] Set up monitoring alerts

---

## Post-Deployment

### 1. Verify Deployment
```bash
# Check API
curl https://api.yourdomain.com/health

# Check admin
curl https://admin.yourdomain.com

# Test authentication
curl -X POST https://api.yourdomain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"Test123!"}'
```

### 2. Monitor First 24 Hours
- Watch error logs
- Monitor server resources
- Check database performance
- Verify backups are running
- Test all critical features

### 3. Set Up Alerts
Configure alerts for:
- Server down
- High error rates
- Database issues
- Disk space warnings
- Memory/CPU thresholds

---

## Support

For deployment issues:
- Check logs: `docker-compose logs backend`
- Review documentation
- Contact DevOps team
- Open GitHub issue

**Production deployed!** 🚀
