# Universal Device Connector - Technology Stack Decision Record

## Document Purpose

This document records all technology stack decisions for the Universal Device Connector project, including rationale, alternatives considered, and trade-offs. All decisions are locked for the duration of the project to ensure consistency and prevent scope creep.

**Last Updated:** 2025-01-15
**Status:** ✅ Approved for Implementation

---

## Executive Summary

### Stack Overview

**Client Applications:**
- **iOS & macOS:** Swift + SwiftUI (native)
- **Android:** Kotlin + Jetpack Compose (native)
- **Windows:** Electron + React + TypeScript

**Backend Services:**
- **Runtime:** Node.js 20 LTS + TypeScript 5.3+
- **Framework:** NestJS 10.x
- **Real-time:** Socket.io 4.x (WebSocket)
- **API Style:** RESTful + WebSocket events

**Data Layer:**
- **Primary Database:** PostgreSQL 16
- **Cache & Pub/Sub:** Redis 7.x
- **Object Storage:** AWS S3 / MinIO (S3-compatible)
- **Secrets Management:** HashiCorp Vault

**Infrastructure:**
- **Cloud Provider:** AWS (primary), with multi-cloud capability
- **Containerization:** Docker
- **Orchestration:** Amazon ECS (Elastic Container Service)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana, ELK Stack, Jaeger

---

## 1. Client Application Stack

### 1.1 iOS Application

#### Decision: Swift + SwiftUI
**Version:** Swift 5.9+, SwiftUI (iOS 17+)

#### Rationale:
1. **Native Performance:** SwiftUI provides native performance and tight OS integration
2. **Modern UI Framework:** Declarative UI matches project's dynamic theming requirements
3. **Platform Features:** Direct access to Face ID, Touch ID, Keychain, file system APIs
4. **Maintainability:** Single language, strong typing, modern syntax
5. **App Store Guidelines:** Native apps have better approval rates and performance

#### Alternatives Considered:
- **React Native:** Cross-platform benefit, but limitations with native APIs (clipboard, file system, remote control). Would require extensive native modules, reducing cross-platform benefits.
- **Flutter:** Good cross-platform support, but iOS-specific features (Face ID, Keychain) require platform channels. SwiftUI is more direct.

#### Trade-offs:
- **Pro:** Best possible iOS experience, full API access, performant
- **Con:** Separate codebase from Android (mitigated by shared backend contracts)

#### Key Libraries:
```swift
// Core
- SwiftUI (UI framework)
- Combine (reactive programming)

// Networking
- URLSession (native, with async/await)
- Starscream (WebSocket client)

// Security
- LocalAuthentication (Face ID / Touch ID)
- CryptoKit (encryption)
- KeychainAccess (secure storage)

// Storage
- GRDB.swift (local SQLite for caching)

// Remote Control
- ReplayKit (screen capture with user consent)
- AVFoundation (media handling)

// Utilities
- SwiftGen (code generation for assets)
- SwiftLint (linting)
- SwiftFormat (formatting)
```

---

### 1.2 macOS Application

#### Decision: Swift + SwiftUI (Native macOS)
**Version:** Swift 5.9+, SwiftUI (macOS 14+)

#### Rationale:
1. **Code Sharing:** Shares 80%+ code with iOS app (models, networking, business logic)
2. **Native Integration:** Access to file system, screen capture (ScreenCaptureKit), Touch ID
3. **Performance:** Native performance for file operations and remote control
4. **Consistent UX:** SwiftUI ensures consistent Apple ecosystem experience

#### Alternatives Considered:
- **Electron:** Cross-platform with Windows, but performance overhead for file operations. macOS users expect native apps.
- **Flutter Desktop:** Limited macOS-specific feature support

#### Trade-offs:
- **Pro:** Excellent performance, native macOS feel, code sharing with iOS
- **Con:** Separate from Windows (acceptable due to platform differences)

#### Key Libraries:
```swift
// Shared with iOS +
- AppKit (macOS-specific APIs)
- ScreenCaptureKit (screen sharing, macOS 12.3+)
- NSWorkspace (system integration)
```

---

### 1.3 Android Application

#### Decision: Kotlin + Jetpack Compose
**Version:** Kotlin 1.9+, Jetpack Compose (API level 26+, Android 8.0+)

#### Rationale:
1. **Modern UI:** Jetpack Compose is declarative, matches SwiftUI paradigm
2. **Native Performance:** Full access to Android APIs
3. **Biometric Support:** BiometricPrompt API for fingerprint/face unlock
4. **File Access:** Storage Access Framework for secure file operations
5. **Language Features:** Kotlin coroutines for async operations (similar to Swift async/await)

#### Alternatives Considered:
- **React Native:** Same concerns as iOS
- **Flutter:** Better than RN for cross-platform, but native is optimal for this use case

#### Trade-offs:
- **Pro:** Best Android experience, full API access
- **Con:** Separate codebase (mitigated by shared API contracts and similar architecture to iOS)

#### Key Libraries:
```kotlin
// Core
- Jetpack Compose (UI)
- Coroutines + Flow (async, reactive)

// Networking
- Retrofit 2.9+ (REST client)
- OkHttp 4.x (HTTP client, WebSocket)
- Moshi (JSON parsing)

// Security
- BiometricPrompt (fingerprint/face auth)
- EncryptedSharedPreferences (secure storage)
- Tink (Google's crypto library)

// Storage
- Room (local database)
- DataStore (preferences)

// Background Work
- WorkManager (background tasks)

// Remote Control
- MediaProjection API (screen capture)
- WebRTC (peer connections)

// DI & Architecture
- Hilt (dependency injection)
- Jetpack Navigation (navigation)
- Paging 3 (data loading)

// Utilities
- Timber (logging)
- LeakCanary (memory leak detection)
- Detekt (static analysis)
```

---

### 1.4 Windows Application

#### Decision: Electron + React + TypeScript
**Version:** Electron 28+, React 18+, TypeScript 5.3+

#### Rationale:
1. **Cross-Platform Base:** Electron provides Windows support with modern web stack
2. **Rich Ecosystem:** npm ecosystem for utilities and UI components
3. **Native Integration:** Node.js addons for Windows Hello, file system, clipboard
4. **Rapid Development:** Mature tooling and large developer community
5. **Consistent UI:** Shares design system tokens with web-based components

#### Alternatives Considered:
- **Flutter Desktop:** Promising but still maturing on Windows; limited library support
- **Tauri:** Lighter than Electron, but smaller ecosystem and less mature
- **Native C#/WPF:** Excellent Windows integration, but requires completely different skillset

#### Trade-offs:
- **Pro:** Fast development, rich ecosystem, good Windows integration via native modules
- **Con:** Larger app size (~100MB vs ~10MB native), higher memory usage (acceptable for desktop)

#### Key Libraries:
```typescript
// Core
- React 18 (UI library)
- TypeScript 5.3+ (type safety)
- Electron 28+ (desktop runtime)

// State Management
- Zustand (lightweight state management)
- TanStack Query (server state)

// UI Components
- Radix UI (headless components)
- Framer Motion (animations)
- Tailwind CSS (utility-first CSS)

// Networking
- Axios (HTTP client)
- Socket.io-client (WebSocket)

// Security
- @electron/remote (IPC)
- keytar (Windows Credential Manager)
- node-forge (crypto)

// Native Integration
- node-screenshots (screen capture)
- robotjs (input simulation for remote control)
- electron-windows-badge (notifications)

// Utilities
- electron-builder (packaging)
- electron-updater (auto-updates)
- ESLint + Prettier (code quality)
```

---

### 1.5 Shared Client Concerns

#### Design System
**Decision:** Design Tokens (JSON) + Platform-Specific Implementation

```json
{
  "colors": {
    "primary": "#000000",
    "accent": {
      "default": "#5E5CE6",
      "dynamic": "system"
    },
    "background": {
      "dark": "#000000",
      "light": "#FFFFFF"
    }
  },
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 16,
    "lg": 24,
    "xl": 32
  },
  "typography": {
    "h1": {"size": 32, "weight": 700},
    "body": {"size": 16, "weight": 400}
  }
}
```

Each platform implements these tokens in native format:
- iOS/macOS: Swift extensions
- Android: Kotlin sealed classes / Compose theme
- Windows: CSS variables / TypeScript constants

---

## 2. Backend Stack

### 2.1 Runtime & Language

#### Decision: Node.js 20 LTS + TypeScript 5.3+

#### Rationale:
1. **Type Safety:** TypeScript provides compile-time safety and excellent IDE support
2. **Async I/O:** Node.js event loop is perfect for real-time, I/O-heavy workloads
3. **Ecosystem:** Massive npm ecosystem for auth, crypto, file handling, WebSocket
4. **Isomorphic:** Share types/interfaces with TypeScript clients (Windows)
5. **Developer Productivity:** Familiar to web developers, fast iteration
6. **Performance:** V8 engine is highly optimized; good enough for this use case

#### Alternatives Considered:
- **Go:** Excellent performance, strong concurrency. However, TypeScript's type sharing with clients and rich ecosystem outweigh marginal performance gains. Go would be ideal for compute-heavy services (we don't have those).
- **Python (FastAPI):** Great for rapid development, but slower runtime and weaker typing
- **Rust:** Maximum performance, but steep learning curve and longer development time

#### Trade-offs:
- **Pro:** Fast development, excellent ecosystem, type sharing, WebSocket libraries
- **Con:** Single-threaded (mitigated by clustering and horizontal scaling)

---

### 2.2 Backend Framework

#### Decision: NestJS 10.x

#### Rationale:
1. **Enterprise Structure:** Opinionated architecture (modules, controllers, services) scales well
2. **Dependency Injection:** Built-in DI container promotes testability
3. **Decorators:** Clean syntax for routes, validation, auth guards
4. **Documentation:** Built-in Swagger/OpenAPI generation
5. **TypeScript-First:** Excellent TypeScript support out of the box
6. **Microservices Ready:** Can split into microservices later if needed
7. **Ecosystem:** Integrations for PostgreSQL, Redis, WebSocket, etc.

#### Alternatives Considered:
- **Express.js:** Minimal and flexible, but requires more boilerplate for structure
- **Fastify:** Faster than Express, but NestJS provides better structure for large projects
- **Koa:** Clean middleware model, but smaller ecosystem

#### Trade-offs:
- **Pro:** Excellent structure, scalability, maintainability, built-in features
- **Con:** Slightly more verbose than Express, learning curve for decorators

#### Key Modules/Libraries:
```typescript
// Core
- @nestjs/core (framework core)
- @nestjs/common (decorators, pipes, guards)
- @nestjs/platform-express (HTTP)

// Database
- @nestjs/typeorm (PostgreSQL ORM)
- typeorm (ORM)
- pg (PostgreSQL client)

// Redis
- @nestjs/ioredis (Redis integration)
- ioredis (Redis client)

// Authentication
- @nestjs/passport (auth strategies)
- passport-jwt (JWT strategy)
- @nestjs/jwt (JWT utilities)
- bcrypt / argon2 (password hashing)

// Validation
- class-validator (DTO validation)
- class-transformer (DTO transformation)

// Real-time
- @nestjs/websockets (WebSocket)
- @nestjs/platform-socket.io (Socket.io adapter)
- socket.io (WebSocket library)

// File Upload
- @nestjs/multer (file upload)
- aws-sdk (S3 client)

// Observability
- @nestjs/terminus (health checks)
- prom-client (Prometheus metrics)
- winston (logging)

// Documentation
- @nestjs/swagger (OpenAPI/Swagger)

// Testing
- @nestjs/testing (test utilities)
- jest (test framework)
- supertest (HTTP testing)
```

---

### 2.3 Real-Time Communication

#### Decision: Socket.io 4.x over WebSocket

#### Rationale:
1. **Reliability:** Auto-reconnection, heartbeat, fallback mechanisms
2. **Rooms & Namespaces:** Perfect for per-user and per-device channels
3. **Binary Support:** Efficient for file transfer metadata and clipboard sync
4. **Authentication:** Middleware support for token validation
5. **Scaling:** Redis adapter for multi-server scaling
6. **Client Libraries:** Available for all platforms (iOS via Starscream wrapper, Android via socket.io-client-java, Windows native)

#### Alternatives Considered:
- **Raw WebSocket:** Lower level, requires custom reliability layer
- **gRPC Streaming:** Great performance, but more complex and no web browser support
- **Server-Sent Events (SSE):** One-way only, not suitable for bidirectional sync

#### Trade-offs:
- **Pro:** Mature, reliable, great DX, built-in scaling
- **Con:** Slightly more overhead than raw WebSocket (acceptable)

---

### 2.4 Database

#### Decision: PostgreSQL 16

#### Rationale:
1. **Reliability:** ACID transactions, proven at scale
2. **Rich Data Types:** JSON/JSONB for flexible schemas (device capabilities, metadata)
3. **Full-Text Search:** Built-in search for files and content
4. **Row-Level Security:** Security at database level
5. **Mature Ecosystem:** Excellent ORMs, tooling, and hosting options
6. **Performance:** Excellent query optimizer, indexes
7. **Extensions:** pgcrypto for encryption, pg_trgm for fuzzy search

#### Alternatives Considered:
- **MySQL:** Solid choice, but PostgreSQL has better JSON support and advanced features
- **MongoDB:** Good for flexibility, but we need transactions and relational data
- **CockroachDB:** Distributed SQL, but unnecessary complexity for initial scale

#### Trade-offs:
- **Pro:** Feature-rich, reliable, excellent for our data model
- **Con:** Vertical scaling limits (mitigated by read replicas and sharding plan)

#### Configuration:
```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Connection Pooling: PgBouncer
-- Replication: Streaming replication for read replicas
-- Backup: Automated daily backups with PITR (Point-in-Time Recovery)
```

---

### 2.5 Caching & Pub/Sub

#### Decision: Redis 7.x

#### Rationale:
1. **Performance:** In-memory, microsecond latency
2. **Data Structures:** Strings, hashes, sets, sorted sets, streams - perfect for our needs
3. **Pub/Sub:** Built-in for real-time event broadcasting
4. **TTL:** Automatic expiration for sessions and temporary data
5. **Atomic Operations:** For rate limiting and distributed locks
6. **Persistence:** Optional RDB/AOF for durability
7. **Clustering:** Redis Cluster for horizontal scaling

#### Alternatives Considered:
- **Memcached:** Simpler, but no data structures or pub/sub
- **DynamoDB:** Cloud-native, but higher latency and cost for cache use case

#### Trade-offs:
- **Pro:** Perfect fit for sessions, presence, cache, pub/sub
- **Con:** Memory-bound (acceptable, data is ephemeral)

#### Usage Patterns:
```redis
# Session Tokens (Hash with TTL)
HSET session:token:{hash} user_id {id} device_id {id}
EXPIRE session:token:{hash} 900

# Device Presence (Sorted Set)
ZADD user:online:{user_id} {timestamp} {device_id}

# Pub/Sub Channels
PUBLISH user:{user_id}:events {json_event}

# Rate Limiting (String Counter)
INCR ratelimit:login:{ip}:{minute}
EXPIRE ratelimit:login:{ip}:{minute} 60
```

---

### 2.6 Object Storage

#### Decision: AWS S3 (Primary) / MinIO (Self-Hosted Alternative)

#### Rationale:
1. **Scalability:** Unlimited storage, automatic scaling
2. **Durability:** 99.999999999% (11 9's) durability
3. **Security:** Encryption at rest, bucket policies, presigned URLs
4. **Performance:** Multi-part upload, CloudFront CDN integration
5. **Cost:** Pay-as-you-go, cost-effective for file storage
6. **Compatibility:** S3 API is industry standard (MinIO is S3-compatible)

#### Alternatives Considered:
- **Filesystem:** Doesn't scale, no redundancy, hard to secure
- **Database BLOBs:** Poor performance, expensive at scale
- **Azure Blob / Google Cloud Storage:** Equivalent features, but AWS for ecosystem consistency

#### Trade-offs:
- **Pro:** Industry-standard, reliable, scalable, secure
- **Con:** Vendor lock-in (mitigated by S3-compatible alternatives like MinIO)

#### Configuration:
```yaml
# S3 Bucket Policy
- Encryption: AES-256 at rest
- Versioning: Enabled
- Lifecycle: Delete after 90 days (temp files)
- CORS: Allowed origins configured
- Public Access: Blocked
- Presigned URLs: 15-minute expiry
```

---

### 2.7 Secrets Management

#### Decision: HashiCorp Vault

#### Rationale:
1. **Security:** Industry-leading secrets management
2. **Dynamic Secrets:** Generate database credentials on-demand
3. **Encryption as a Service:** Centralized encryption key management
4. **Audit Logging:** All access logged
5. **Access Control:** Fine-grained policies
6. **Multi-Cloud:** Works across AWS, Azure, GCP

#### Alternatives Considered:
- **AWS Secrets Manager:** Cloud-specific, less flexible
- **Environment Variables:** Insecure, hard to rotate
- **Encrypted Config Files:** Manual process, doesn't scale

#### Trade-offs:
- **Pro:** Maximum security, best practices, auditable
- **Con:** Additional infrastructure to manage (acceptable for production security)

---

## 3. Infrastructure & DevOps

### 3.1 Cloud Provider

#### Decision: Amazon Web Services (AWS) - Primary

#### Rationale:
1. **Comprehensive Services:** ECS, RDS, ElastiCache, S3, CloudFront, Route 53
2. **Global Reach:** Multiple regions for low latency
3. **Mature Ecosystem:** Extensive documentation and community
4. **Security:** Compliance certifications, security tools
5. **Cost Management:** Flexible pricing, cost optimization tools

#### Multi-Cloud Strategy:
- **Primary:** AWS (us-east-1, us-west-2)
- **DR:** AWS (eu-west-1)
- **Self-Hosted Option:** Docker Compose + MinIO for development and small deployments

#### Trade-offs:
- **Pro:** Best-in-class services, reliability, global reach
- **Con:** Vendor lock-in (mitigated by containerization and S3-compatible storage)

---

### 3.2 Containerization

#### Decision: Docker

#### Rationale:
1. **Portability:** Run anywhere (local, AWS, Azure, GCP)
2. **Isolation:** Each service runs in isolated environment
3. **Consistency:** Dev/prod parity
4. **Ecosystem:** Massive library of base images and tools
5. **CI/CD Integration:** First-class support in GitHub Actions

#### Container Strategy:
```dockerfile
# Multi-stage builds for minimal image size
# Alpine Linux base (small footprint)
# Non-root user for security
# Health checks built into Dockerfile
# Vulnerability scanning with Trivy
```

---

### 3.3 Orchestration

#### Decision: Amazon ECS (Elastic Container Service) with Fargate

#### Rationale:
1. **Managed:** No Kubernetes complexity
2. **Serverless:** Fargate removes server management
3. **AWS Integration:** Native integration with ALB, CloudWatch, Secrets Manager
4. **Auto-Scaling:** Based on CPU/memory or custom metrics
5. **Cost:** Pay only for what you use

#### Alternatives Considered:
- **Kubernetes (EKS):** More powerful but overkill for initial scale; can migrate later if needed
- **EC2 + Docker Compose:** Manual scaling, more operational overhead

#### Trade-offs:
- **Pro:** Simple, managed, cost-effective, scales well
- **Con:** Less portable than Kubernetes (acceptable for AWS-focused deployment)

---

### 3.4 CI/CD

#### Decision: GitHub Actions

#### Rationale:
1. **Integration:** Native GitHub integration
2. **Free Tier:** Generous free minutes for open source/private repos
3. **Matrix Builds:** Build iOS, Android, Windows in parallel
4. **Secrets Management:** Encrypted secrets for credentials
5. **Ecosystem:** Rich marketplace of actions
6. **Self-Hosted Runners:** Option for macOS builds (required for iOS)

#### Pipeline Stages:
```yaml
# On Pull Request:
- Lint (ESLint, SwiftLint, Detekt)
- Type Check (TypeScript, Swift, Kotlin)
- Unit Tests
- Security Scan (Snyk, Trivy)
- Build (all platforms)

# On Merge to Main:
- All PR checks +
- Integration Tests
- E2E Tests (Playwright, XCUITest, Espresso)
- Build Docker Images
- Push to ECR (Elastic Container Registry)
- Deploy to Staging
- Smoke Tests

# On Tag (Release):
- All Main checks +
- Deploy to Production
- Build App Store / Google Play Bundles
- Create GitHub Release
```

---

### 3.5 Observability

#### Decision: Prometheus + Grafana + ELK + Jaeger

**Metrics:** Prometheus + Grafana
- **Rationale:** Industry standard, rich query language (PromQL), beautiful dashboards

**Logging:** ELK Stack (Elasticsearch + Logstash + Kibana)
- **Rationale:** Centralized logging, powerful search, log aggregation from all services

**Tracing:** Jaeger
- **Rationale:** Distributed tracing for debugging cross-service requests

#### Alternatives Considered:
- **DataDog:** Excellent all-in-one solution, but expensive at scale
- **New Relic:** Similar to DataDog
- **AWS CloudWatch:** Good AWS integration, but limited compared to specialized tools

#### Trade-offs:
- **Pro:** Best-in-class open-source tools, customizable, cost-effective
- **Con:** More setup than SaaS (acceptable for control and cost)

---

## 4. Development Tools

### 4.1 Version Control

#### Decision: Git + GitHub

- **Monorepo:** Single repository for all services and clients
- **Branching:** Git Flow (main, develop, feature/*, hotfix/*)
- **Protected Branches:** main and develop require PR + 2 approvals
- **Signed Commits:** GPG signing required for releases

---

### 4.2 Code Quality

#### Decisions:
- **Linting:** ESLint (TypeScript), SwiftLint (Swift), Detekt (Kotlin)
- **Formatting:** Prettier (TypeScript), SwiftFormat (Swift), ktlint (Kotlin)
- **Type Checking:** TypeScript strict mode, Swift strict concurrency
- **Testing:** Jest (backend), XCTest (iOS/macOS), JUnit + Espresso (Android), Playwright (Windows E2E)

---

### 4.3 Documentation

#### Decisions:
- **API Docs:** OpenAPI/Swagger (auto-generated from NestJS)
- **Architecture Docs:** Markdown in repo (living documents)
- **Code Comments:** JSDoc/TSDoc (TypeScript), DocC (Swift), KDoc (Kotlin)
- **ADRs:** Architecture Decision Records for major decisions

---

## 5. Security Stack

### 5.1 Authentication & Authorization

#### Decisions:
- **Password Hashing:** Argon2id
- **JWT:** RS256 (asymmetric signing)
- **OAuth2/OIDC:** Google, Apple Sign-In
- **WebAuthn:** For passwordless auth
- **Biometrics:** Platform-native APIs (LocalAuthentication, BiometricPrompt)

---

### 5.2 Encryption

#### Decisions:
- **In Transit:** TLS 1.3, certificate pinning
- **At Rest:** AES-256-GCM
- **File Encryption:** Per-file keys derived from master key
- **Key Management:** HashiCorp Vault
- **Hashing:** SHA-256 for file integrity

---

### 5.3 Security Scanning

#### Decisions:
- **SAST:** SonarQube
- **DAST:** OWASP ZAP
- **Dependency Scanning:** Snyk, npm audit, OWASP Dependency-Check
- **Container Scanning:** Trivy
- **Secrets Scanning:** GitGuardian / TruffleHog

---

## 6. Platform-Specific Feasibility

### iOS (✅ Fully Supported)
- **Biometrics:** LocalAuthentication (Face ID, Touch ID)
- **Clipboard:** UIPasteboard
- **Files:** FileManager, UIDocumentPickerViewController
- **Remote Control:** ReplayKit (screen share), AVFoundation
- **Background:** Background Tasks framework, URLSession background transfers

### Android (✅ Fully Supported)
- **Biometrics:** BiometricPrompt (fingerprint, face, iris)
- **Clipboard:** ClipboardManager
- **Files:** Storage Access Framework, MediaStore
- **Remote Control:** MediaProjection API
- **Background:** WorkManager, Foreground Services

### macOS (✅ Fully Supported)
- **Biometrics:** LocalAuthentication (Touch ID)
- **Clipboard:** NSPasteboard
- **Files:** FileManager, NSOpenPanel
- **Remote Control:** ScreenCaptureKit (macOS 12.3+), CGDisplayStream
- **Background:** Launch Agents

### Windows (✅ Fully Supported)
- **Biometrics:** Windows Hello via Web Authentication API
- **Clipboard:** Electron clipboard API, native monitoring
- **Files:** Node.js fs module, Electron file dialogs
- **Remote Control:** node-screenshots, robotjs
- **Background:** Electron app.setLoginItemSettings()

### Known Limitations:
1. **iOS Background File Transfer:** Limited by iOS background execution limits (mitigated by URLSession background transfers)
2. **Android Battery Optimization:** May kill background sync (mitigated by Foreground Services and user education)
3. **Windows Biometric:** Windows Hello requires compatible hardware (fallback to password)

---

## 7. Hosting & Deployment Strategy

### Production Architecture

```yaml
Primary Region (us-east-1):
  - Application Load Balancer
  - ECS Cluster (Fargate)
    - Auth Service (3 tasks)
    - Device Registry (2 tasks)
    - File Broker (3 tasks)
    - Real-Time Gateway (4 tasks)
    - Remote Control Service (2 tasks)
    - Sync Engine (2 tasks)
  - RDS PostgreSQL (Multi-AZ, db.r6g.xlarge)
  - ElastiCache Redis Cluster (3 nodes)
  - S3 Bucket (versioning, encryption)
  - CloudFront CDN
  - Route 53 (DNS, health checks)

Secondary Region (us-west-2):
  - Same architecture (standby)
  - RDS Read Replica
  - S3 Cross-Region Replication

DR Region (eu-west-1):
  - Minimal standby (activated on primary region failure)
```

### Cost Estimate (Initial):
- **Compute (ECS Fargate):** ~$300/month
- **Database (RDS):** ~$200/month
- **Cache (ElastiCache):** ~$100/month
- **Storage (S3):** ~$50/month (first 1TB)
- **Data Transfer:** ~$50/month
- **Monitoring:** ~$50/month
- **Total:** ~$750/month (scales with usage)

---

## 8. Decision Matrix Summary

| Component | Decision | Confidence | Risk Level |
|-----------|----------|------------|------------|
| iOS App | Swift + SwiftUI | High | Low |
| Android App | Kotlin + Compose | High | Low |
| macOS App | Swift + SwiftUI | High | Low |
| Windows App | Electron + React | Medium | Low |
| Backend Runtime | Node.js + TypeScript | High | Low |
| Backend Framework | NestJS | High | Low |
| Database | PostgreSQL | High | Low |
| Cache/PubSub | Redis | High | Low |
| Object Storage | S3 / MinIO | High | Low |
| Secrets | HashiCorp Vault | Medium | Medium |
| Cloud | AWS | High | Low |
| Containers | Docker + ECS | High | Low |
| CI/CD | GitHub Actions | High | Low |
| Monitoring | Prometheus + ELK | Medium | Low |

---

## 9. Migration & Future Considerations

### Potential Future Changes (Post-Launch):
1. **Scale Beyond ECS:** Migrate to Kubernetes (EKS) if microservices needed
2. **Multi-Cloud:** Add Azure/GCP support for geographic diversity
3. **Edge Computing:** CloudFlare Workers for global presence API
4. **GraphQL:** Add GraphQL API alongside REST for flexible client queries
5. **Mobile Backend as a Service:** Consider Firebase for mobile-specific features

### Non-Negotiables (Will Not Change):
1. **TypeScript:** All backend code remains TypeScript
2. **Native Mobile:** iOS and Android will always be native (no cross-platform migration)
3. **PostgreSQL:** Primary database will remain PostgreSQL
4. **Security-First:** No compromise on security stack

---

**Document Status:** ✅ Approved and Locked
**Review Date:** Quarterly review for technology updates
**Change Process:** Any stack change requires RFC (Request for Comments) and team approval

This technology stack provides a solid, production-ready foundation for the Universal Device Connector project.
