# Universal Device Connector - Threat Model

## Executive Summary

This document identifies security threats to the Universal Device Connector system and defines mitigation strategies for each threat. The system handles sensitive data including files, clipboard contents, device control, and biometric authentication across multiple platforms.

**Risk Classification:**
- **Critical:** Could lead to complete system compromise, data breach, or unauthorized device control
- **High:** Could lead to unauthorized access to user data or limited device control
- **Medium:** Could lead to service disruption or limited information disclosure
- **Low:** Minor security concerns with limited impact

---

## Threat Categories

### 1. Authentication & Authorization Threats

#### T-AUTH-001: Account Takeover via Password Compromise
**Risk Level:** Critical
**Description:** Attacker gains access to user credentials through phishing, credential stuffing, or password reuse.

**Attack Vectors:**
- Phishing emails impersonating the service
- Credential stuffing from breached databases
- Weak password selection by users
- Password reuse across services

**Mitigations:**
- **Code/Config:**
  - Enforce strong password requirements (min 12 chars, complexity)
  - Implement Argon2id password hashing (time=3, memory=65536, parallelism=4)
  - Rate limiting: 5 failed login attempts per minute per IP
  - Account lockout after 10 failed attempts in 1 hour
  - Mandatory email verification on registration
  - Password breach detection via HaveIBeenPwned API

- **Infrastructure:**
  - WAF rules to detect credential stuffing patterns
  - IP reputation checks
  - Geo-blocking for suspicious login patterns

- **Process:**
  - Mandatory password reset notifications
  - Security notifications for new device logins
  - Optional 2FA/MFA enforcement

**Residual Risk:** Low - Users may still fall for sophisticated phishing, but multi-device approval adds significant protection

---

#### T-AUTH-002: Session Token Theft
**Risk Level:** High
**Description:** Attacker intercepts or steals session tokens to impersonate authenticated user.

**Attack Vectors:**
- Man-in-the-middle attacks on network
- XSS attacks extracting tokens from storage
- Malware on client device
- Physical access to unlocked device

**Mitigations:**
- **Code/Config:**
  - TLS 1.3 enforcement for all connections
  - Certificate pinning on mobile clients
  - HTTP-only, Secure, SameSite cookies
  - Short-lived access tokens (15 minutes)
  - Refresh token rotation on each use
  - Device-bound tokens (signed with device key)
  - Token binding to IP address (with grace period for mobile)
  - Automatic logout on suspicious activity

- **Infrastructure:**
  - HSTS headers with preload
  - Strong TLS cipher suites only
  - Regular SSL certificate rotation

- **Process:**
  - Immediate token revocation on device removal
  - User notification of active sessions with ability to revoke

**Residual Risk:** Low - Device malware remains a risk, but device binding and short token lifetimes limit exposure

---

#### T-AUTH-003: Device Impersonation
**Risk Level:** Critical
**Description:** Attacker registers a malicious device as belonging to a legitimate user.

**Attack Vectors:**
- Compromised registration flow
- Stolen device registration token
- Social engineering to approve malicious device
- Compromised biometric approval flow

**Mitigations:**
- **Code/Config:**
  - Device registration requires authenticated session
  - Public key cryptography for device identity
  - Unique device identifier verification (TPM/Secure Enclave where available)
  - Mandatory biometric approval for new device additions
  - Device fingerprinting (OS version, model, etc.)
  - Device trust establishment with explicit user consent
  - Real-time notification to all devices on new device registration
  - Ability to immediately revoke any device
  - Device capability verification against known platform capabilities

- **Infrastructure:**
  - Anomaly detection for rapid device registrations
  - Geo-location checks for new devices

- **Process:**
  - User education on device approval
  - Regular device audit prompts
  - Automatic removal of inactive devices after 90 days (with warning)

**Residual Risk:** Medium - Sophisticated attacker with access to user's phone during approval could register malicious device

---

#### T-AUTH-004: Biometric Spoofing
**Risk Level:** High
**Description:** Attacker bypasses biometric authentication using fake fingerprints, photos, or other spoofing techniques.

**Attack Vectors:**
- Fake fingerprints created from photos or copies
- High-resolution photos for face recognition bypass
- 3D-printed faces
- Unconscious user manipulation

**Mitigations:**
- **Code/Config:**
  - Use platform-native biometric APIs (Apple LocalAuthentication, Android BiometricPrompt)
  - Rely on OS-level liveness detection
  - Fallback to password for high-risk operations
  - Biometric approval timeout (2 minutes)
  - One-time biometric approvals (cannot be replayed)
  - Contextual information shown during approval (device name, action, location)
  - Audit log of all biometric approvals

- **Infrastructure:**
  - N/A (relies on device security)

- **Process:**
  - User education on biometric security
  - Recommendation to use PIN/password for sensitive operations in high-risk scenarios

**Residual Risk:** Medium - Platform biometric security is only as good as the OS implementation; physical access remains a risk

---

### 2. Data Security Threats

#### T-DATA-001: File Interception During Transfer
**Risk Level:** Critical
**Description:** Attacker intercepts file contents during upload/download or device-to-device transfer.

**Attack Vectors:**
- Network eavesdropping (WiFi, public networks)
- Compromised network infrastructure
- Man-in-the-middle attacks
- Compromised cloud storage

**Mitigations:**
- **Code/Config:**
  - TLS 1.3 for all file transfers
  - End-to-end encryption for file contents (AES-256-GCM)
  - Separate encryption keys per file (derived from master key)
  - File encryption before upload to S3
  - Encryption keys stored in Vault, never in database
  - File integrity verification via SHA-256 hashes
  - Signed URLs with short expiry (15 minutes)
  - Certificate pinning on clients

- **Infrastructure:**
  - S3 server-side encryption at rest
  - S3 bucket policies enforcing HTTPS
  - VPC endpoints for S3 access (no public internet)
  - DDoS protection on file transfer endpoints

- **Process:**
  - Regular security audits of encryption implementation
  - Key rotation every 90 days

**Residual Risk:** Low - Multiple layers of encryption protect file contents

---

#### T-DATA-002: Clipboard Data Leakage
**Risk Level:** High
**Description:** Sensitive clipboard data (passwords, private keys, PII) is exposed through sync mechanism.

**Attack Vectors:**
- Clipboard contents synced to compromised device
- Clipboard data intercepted in transit
- Clipboard history accessible after device theft
- Malicious app monitoring clipboard

**Mitigations:**
- **Code/Config:**
  - Clipboard sync disabled by default
  - Explicit per-device opt-in required
  - Size limit on clipboard sync (1MB)
  - Content type filtering (no password field contents)
  - Detection of sensitive patterns (credit cards, SSNs, private keys)
  - Automatic blocking of sensitive content
  - Encryption in transit (TLS) and at rest
  - Automatic expiry of clipboard history (24 hours)
  - Notification when clipboard is synced
  - Ability to clear clipboard history remotely

- **Infrastructure:**
  - Clipboard data stored in Redis with TTL
  - No permanent storage of clipboard contents

- **Process:**
  - User education on clipboard sync risks
  - Recommendation to disable for sensitive work
  - Regular clipboard history cleanup

**Residual Risk:** Medium - Users may unknowingly copy sensitive data; pattern detection helps but isn't foolproof

---

#### T-DATA-003: Unauthorized File Access
**Risk Level:** High
**Description:** Attacker gains access to files they shouldn't be able to view or download.

**Attack Vectors:**
- Authorization bypass in API
- Direct object reference vulnerability
- Compromised device with overly broad permissions
- S3 bucket misconfiguration

**Mitigations:**
- **Code/Config:**
  - Row-level security in PostgreSQL
  - Every file access checks user_id ownership
  - Device trust validation before file sharing
  - S3 presigned URLs with user/device validation
  - Short-lived presigned URLs (15 minutes)
  - S3 bucket ACLs preventing public access
  - File access audit logging
  - Rate limiting on file downloads

- **Infrastructure:**
  - S3 bucket policies denying public access
  - CloudFront signed URLs for additional security
  - WAF rules detecting access pattern anomalies

- **Process:**
  - Regular penetration testing
  - Automated security scanning in CI
  - Code review focusing on authorization checks

**Residual Risk:** Low - Defense in depth with multiple authorization layers

---

#### T-DATA-004: Data Breach via Database Compromise
**Risk Level:** Critical
**Description:** Attacker gains access to the PostgreSQL database containing user data.

**Attack Vectors:**
- SQL injection vulnerabilities
- Stolen database credentials
- Database server compromise
- Unpatched database vulnerabilities
- Insider threat

**Mitigations:**
- **Code/Config:**
  - Parameterized queries (no string concatenation)
  - ORM usage (TypeORM with query builders)
  - Input validation and sanitization
  - Sensitive data encryption at application layer before DB storage
  - Password hashes (Argon2id), never plaintext
  - Token hashes, not tokens themselves
  - Database credentials from Vault, not environment variables
  - Least privilege database roles
  - Separate read/write database users

- **Infrastructure:**
  - RDS encryption at rest (AES-256)
  - Database in private subnet (no public access)
  - Security groups limiting access to app servers only
  - Automated backups with encryption
  - Database activity monitoring
  - Intrusion detection systems

- **Process:**
  - Regular database security audits
  - Automated vulnerability scanning
  - Penetration testing focused on SQL injection
  - Database access logging and monitoring
  - Incident response plan for data breach

**Residual Risk:** Low - Multiple defensive layers, but insider threat and zero-day exploits remain possible

---

### 3. Network & Infrastructure Threats

#### T-NET-001: Man-in-the-Middle on Local Network
**Risk Level:** High
**Description:** Attacker on same local network intercepts traffic between devices or to backend.

**Attack Vectors:**
- ARP spoofing
- Rogue WiFi access points
- Compromised routers
- DNS spoofing
- Public WiFi networks

**Mitigations:**
- **Code/Config:**
  - TLS 1.3 mandatory for all connections
  - Certificate pinning on mobile/desktop clients
  - HSTS with preload
  - DNS-over-HTTPS (DoH) support
  - Public key pinning for critical endpoints
  - End-to-end encryption for P2P connections (WebRTC with DTLS-SRTP)

- **Infrastructure:**
  - DNSSEC for domain
  - CAA records preventing unauthorized certificate issuance
  - Certificate Transparency monitoring

- **Process:**
  - User warnings when connecting over public WiFi
  - VPN recommendation for sensitive operations

**Residual Risk:** Low - TLS and certificate pinning prevent successful MITM attacks

---

#### T-NET-002: DDoS Attacks
**Risk Level:** Medium
**Description:** Attacker overwhelms system with traffic, causing service disruption.

**Attack Vectors:**
- Volumetric attacks (UDP floods, amplification)
- Application-layer attacks (HTTP floods)
- SYN floods
- Slowloris attacks
- WebSocket connection exhaustion

**Mitigations:**
- **Code/Config:**
  - Rate limiting per IP, per user, per device
  - Connection limits per client
  - Request size limits
  - Timeout configurations
  - WebSocket connection limits and heartbeats
  - Graceful degradation under load

- **Infrastructure:**
  - AWS Shield Standard (free DDoS protection)
  - CloudFront CDN with DDoS mitigation
  - WAF with rate limiting rules
  - Auto-scaling groups responding to load
  - Health checks and automatic failover
  - Multi-region deployment

- **Process:**
  - DDoS response playbook
  - Monitoring and alerting for traffic anomalies
  - Contact with DDoS mitigation provider

**Residual Risk:** Medium - Large-scale attacks may still cause temporary degradation

---

#### T-NET-003: Backend Service Compromise
**Risk Level:** Critical
**Description:** Attacker gains unauthorized access to backend services (API, database, S3).

**Attack Vectors:**
- Exploiting application vulnerabilities
- Stolen service credentials
- Container escape
- Compromised CI/CD pipeline
- Supply chain attack (compromised dependency)

**Mitigations:**
- **Code/Config:**
  - Input validation on all endpoints
  - Output encoding to prevent injection
  - Dependency scanning (npm audit, Snyk)
  - Container image scanning
  - Secrets in Vault, never in code or environment
  - Principle of least privilege for service accounts
  - Network segmentation between services
  - mTLS for service-to-service communication

- **Infrastructure:**
  - Immutable infrastructure (containers)
  - Regular patching and updates
  - Security groups restricting service access
  - VPC with private subnets for services
  - Bastion host for administrative access
  - Multi-factor authentication for AWS console
  - CloudTrail logging all API calls
  - GuardDuty for threat detection

- **Process:**
  - Security code reviews
  - Automated SAST/DAST scanning in CI
  - Penetration testing quarterly
  - Incident response plan
  - Regular security training for developers
  - Supply chain security (verified dependencies)

**Residual Risk:** Medium - Zero-day vulnerabilities and sophisticated attacks may succeed

---

### 4. Device & Client Threats

#### T-CLIENT-001: Stolen/Lost Device
**Risk Level:** High
**Description:** Physical device loss leading to unauthorized access.

**Attack Vectors:**
- Theft or loss of unlocked device
- Device without lock screen
- Biometric bypass on stolen device
- Data extraction from device storage

**Mitigations:**
- **Code/Config:**
  - Mandatory biometric/PIN lock on app launch
  - App locks after 5 minutes of inactivity
  - Tokens stored in secure storage (Keychain/Keystore)
  - Local data encryption using device hardware keys
  - Remote device wipe capability
  - Automatic device removal after 30 days inactive
  - Session revocation on device removal
  - File cache encryption

- **Infrastructure:**
  - Backend enforcement of session invalidation

- **Process:**
  - User education on device security
  - "Lost device" flow in settings
  - Immediate notification of device removal to other devices

**Residual Risk:** Medium - Unlocked device in attacker hands provides brief access window before auto-lock

---

#### T-CLIENT-002: Malicious App on Device
**Risk Level:** High
**Description:** Malware or malicious app on user's device compromises the connector app.

**Attack Vectors:**
- Keyloggers capturing passwords
- Screen recording malware
- Clipboard monitoring malware
- Memory dump attacks
- Debugger attachment
- Repackaged/trojanized app

**Mitigations:**
- **Code/Config:**
  - App integrity checks (anti-tampering)
  - Debugger detection
  - Root/jailbreak detection (warning only, not blocking)
  - Certificate pinning prevents proxy inspection
  - Sensitive data cleared from memory after use
  - Secure keyboard for password entry (where available)
  - Screenshot blocking for sensitive screens
  - App signing with developer certificates

- **Infrastructure:**
  - App distribution through official stores only

- **Process:**
  - Regular security audits of client code
  - User education on app download sources
  - Behavioral anomaly detection (unusual API patterns)

**Residual Risk:** High - Cannot fully protect against device-level compromise; relies on OS security

---

#### T-CLIENT-003: Clipboard Hijacking
**Risk Level:** Medium
**Description:** Malicious app modifies clipboard contents to redirect payments or inject malicious data.

**Attack Vectors:**
- Malware replacing cryptocurrency addresses
- Malware injecting malicious URLs
- Clipboard history theft

**Mitigations:**
- **Code/Config:**
  - Clipboard content verification before sync
  - Warning on clipboard sync of detected sensitive patterns
  - User confirmation for syncing large clipboard items
  - Clipboard sync notifications
  - Option to disable clipboard sync entirely

- **Infrastructure:**
  - N/A

- **Process:**
  - User education on clipboard hijacking risks
  - Recommendation to verify critical pastes

**Residual Risk:** High - Cannot prevent local clipboard hijacking, only cross-device propagation

---

### 5. Remote Control Threats

#### T-REMOTE-001: Unauthorized Remote Control
**Risk Level:** Critical
**Description:** Attacker gains remote control of user's device without authorization.

**Attack Vectors:**
- Bypassing approval flow
- Session hijacking
- Approval phishing/social engineering
- Persistent remote access via vulnerability

**Mitigations:**
- **Code/Config:**
  - Mandatory explicit approval for every session
  - Biometric approval required for control requests
  - Session timeout (30 minutes max, configurable)
  - Persistent on-screen indicator during remote control
  - One-click "Stop Control" button always visible
  - No auto-approval or "remember this device" option
  - Session tokens bound to specific devices
  - Detailed approval prompt (who, what, when)
  - Audit log of all remote control sessions
  - Rate limiting on control requests

- **Infrastructure:**
  - Backend validation of approval before session start
  - Session monitoring for anomalies

- **Process:**
  - User education on remote control risks
  - Regular review of remote control history
  - Notifications of remote control sessions to email

**Residual Risk:** Medium - Social engineering could trick user into approving malicious session

---

#### T-REMOTE-002: Session Hijacking
**Risk Level:** High
**Description:** Attacker intercepts and takes over an active remote control session.

**Attack Vectors:**
- WebRTC connection hijacking
- TURN/STUN server compromise
- Session token theft
- Man-in-the-middle on signaling

**Mitigations:**
- **Code/Config:**
  - DTLS-SRTP encryption for WebRTC media
  - Perfect forward secrecy
  - Session tokens rotated during session
  - Device authentication for all signaling messages
  - Encrypted data channels
  - Heartbeat monitoring (disconnect on missed heartbeats)
  - Mutual authentication of peers

- **Infrastructure:**
  - Secure TURN/STUN servers with credentials
  - Short-lived TURN credentials (1 hour)

- **Process:**
  - Monitoring for connection anomalies
  - User notification of session disconnections

**Residual Risk:** Low - WebRTC encryption and authentication provide strong protection

---

#### T-REMOTE-003: Covert Recording
**Risk Level:** High
**Description:** Remote control session is recorded without user awareness.

**Attack Vectors:**
- Malicious controller recording screen
- Server-side session recording
- Compromised WebRTC connection recording stream

**Mitigations:**
- **Code/Config:**
  - Clear disclosure that sessions may be recorded by controller
  - Persistent on-screen indicator on controlled device
  - No server-side recording (P2P only)
  - User control over session recording preference
  - Warning to controller that recording may be visible

- **Infrastructure:**
  - No server-side media processing or storage

- **Process:**
  - User education on remote control privacy
  - Legal terms prohibiting unauthorized recording
  - Logging of session participants for accountability

**Residual Risk:** High - Cannot prevent controller from recording; only disclosure and consent

---

### 6. Supply Chain & Operational Threats

#### T-SUPPLY-001: Compromised Dependency
**Risk Level:** High
**Description:** Malicious code introduced through npm package or other dependency.

**Attack Vectors:**
- Typosquatting attacks
- Compromised maintainer accounts
- Malicious package updates
- Backdoored dependencies

**Mitigations:**
- **Code/Config:**
  - Dependency pinning (exact versions, not ranges)
  - Lock files committed to repository
  - Automated dependency scanning (Snyk, npm audit)
  - License checking (no unknown licenses)
  - Minimal dependency philosophy
  - Regular dependency updates with review

- **Infrastructure:**
  - CI pipeline blocks on vulnerabilities
  - Private npm registry with proxy/cache

- **Process:**
  - Manual review of dependency updates
  - Security advisory monitoring
  - Vendor security assessment for critical dependencies
  - Incident response plan for compromised dependencies

**Residual Risk:** Medium - Zero-day vulnerabilities in dependencies are difficult to detect

---

#### T-SUPPLY-002: Compromised Build Pipeline
**Risk Level:** Critical
**Description:** Attacker injects malicious code during build or deployment process.

**Attack Vectors:**
- Compromised CI/CD credentials
- Malicious CI job modifications
- Build artifact tampering
- Compromised build environment

**Mitigations:**
- **Code/Config:**
  - Signed commits (GPG)
  - Protected branches (main, release)
  - Required code reviews (minimum 2 reviewers)
  - Branch protection rules
  - Build reproducibility (deterministic builds)
  - Artifact signing
  - Build provenance tracking

- **Infrastructure:**
  - Isolated build environments
  - Immutable build agents
  - Secret management in CI (no long-lived credentials)
  - Audit logging of all CI actions
  - Multi-factor authentication for CI access

- **Process:**
  - Regular audit of CI/CD configuration
  - Incident response for compromised builds
  - SBOM (Software Bill of Materials) generation

**Residual Risk:** Low - Multiple controls protect build integrity

---

#### T-SUPPLY-003: Insider Threat
**Risk Level:** High
**Description:** Malicious or negligent insider compromises system or data.

**Attack Vectors:**
- Developer with access inserts backdoor
- Administrator exfiltrates user data
- Negligent employee leaks credentials
- Disgruntled employee sabotage

**Mitigations:**
- **Code/Config:**
  - Mandatory code reviews (no self-merge)
  - Audit logging of all administrative actions
  - Principle of least privilege
  - Separation of duties
  - No single person has complete system access

- **Infrastructure:**
  - CloudTrail logging all AWS actions
  - Alerts on sensitive operations
  - Database query logging
  - Jump boxes for production access
  - Session recording for administrative access

- **Process:**
  - Background checks for employees
  - Security training and awareness
  - Access reviews quarterly
  - Offboarding checklist (immediate access revocation)
  - Incident response plan for insider threats
  - Legal agreements (NDA, acceptable use)

**Residual Risk:** Medium - Trusted insiders always pose risk; detection and deterrence are key

---

## Threat Matrix Summary

| Threat ID | Threat | Risk Level | Mitigation Status | Residual Risk |
|-----------|--------|------------|-------------------|---------------|
| T-AUTH-001 | Account Takeover | Critical | Fully Mitigated | Low |
| T-AUTH-002 | Session Token Theft | High | Fully Mitigated | Low |
| T-AUTH-003 | Device Impersonation | Critical | Mostly Mitigated | Medium |
| T-AUTH-004 | Biometric Spoofing | High | Partially Mitigated | Medium |
| T-DATA-001 | File Interception | Critical | Fully Mitigated | Low |
| T-DATA-002 | Clipboard Leakage | High | Mostly Mitigated | Medium |
| T-DATA-003 | Unauthorized File Access | High | Fully Mitigated | Low |
| T-DATA-004 | Database Breach | Critical | Fully Mitigated | Low |
| T-NET-001 | MITM Attack | High | Fully Mitigated | Low |
| T-NET-002 | DDoS Attack | Medium | Partially Mitigated | Medium |
| T-NET-003 | Backend Compromise | Critical | Mostly Mitigated | Medium |
| T-CLIENT-001 | Stolen Device | High | Mostly Mitigated | Medium |
| T-CLIENT-002 | Malicious App | High | Partially Mitigated | High |
| T-CLIENT-003 | Clipboard Hijacking | Medium | Partially Mitigated | High |
| T-REMOTE-001 | Unauthorized Remote Control | Critical | Mostly Mitigated | Medium |
| T-REMOTE-002 | Session Hijacking | High | Fully Mitigated | Low |
| T-REMOTE-003 | Covert Recording | High | Partially Mitigated | High |
| T-SUPPLY-001 | Compromised Dependency | High | Mostly Mitigated | Medium |
| T-SUPPLY-002 | Compromised Build | Critical | Fully Mitigated | Low |
| T-SUPPLY-003 | Insider Threat | High | Partially Mitigated | Medium |

---

## Compliance & Privacy Considerations

### GDPR Compliance
- User data minimization
- Right to access (data export API)
- Right to deletion (account deletion flow)
- Right to portability
- Consent management for data processing
- Data breach notification (72-hour requirement)
- Privacy by design and default

### CCPA Compliance
- "Do Not Sell My Data" compliance (not applicable - no data selling)
- User data access requests
- Data deletion requests
- Privacy policy transparency

### Platform-Specific Privacy
- iOS App Privacy Labels (accurate declaration)
- Android Data Safety section
- Permission rationale explanations
- Minimal permissions requested

---

## Incident Response Plan

### Detection
- Automated alerting on anomalies
- User reports
- Security scanning findings
- Third-party vulnerability disclosures

### Response
1. **Triage:** Assess severity and impact
2. **Containment:** Isolate affected systems
3. **Eradication:** Remove threat and vulnerabilities
4. **Recovery:** Restore normal operations
5. **Lessons Learned:** Post-mortem and improvements

### Communication
- Internal stakeholders notification
- User notification (if data breach)
- Regulatory notification (if required)
- Public disclosure (if necessary)

---

## Security Testing Requirements

### Automated Testing
- SAST (Static Application Security Testing) in CI
- DAST (Dynamic Application Security Testing) pre-release
- Dependency scanning daily
- Container image scanning on build
- Secrets scanning in repository

### Manual Testing
- Penetration testing quarterly
- Security code review for critical changes
- Red team exercises annually
- Bug bounty program (post-launch)

### Compliance Testing
- OWASP Top 10 verification
- Mobile app security (OWASP MASVS)
- API security (OWASP API Security Top 10)

---

This threat model is a living document and must be updated as new threats emerge and new features are added to the system.
