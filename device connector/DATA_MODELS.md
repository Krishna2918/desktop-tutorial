# Universal Device Connector - Data Models

## Overview

This document defines all data models used across the Universal Device Connector system. All models include proper indexing, constraints, and validation rules for production use.

## Database Schema (PostgreSQL)

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255), -- NULL for OAuth-only users
    display_name VARCHAR(100),
    avatar_url TEXT,
    oauth_provider VARCHAR(50), -- 'google', 'apple', NULL
    oauth_subject VARCHAR(255), -- External OAuth user ID
    account_status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_account_status CHECK (account_status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_subject);
CREATE INDEX idx_users_created_at ON users(created_at);
```

---

### Devices Table

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'macos', 'windows'
    os_version VARCHAR(50),
    app_version VARCHAR(50) NOT NULL,
    device_model VARCHAR(100), -- e.g., 'iPhone 14 Pro', 'MacBook Pro'
    unique_identifier VARCHAR(255) UNIQUE NOT NULL, -- Device-specific ID
    public_key TEXT NOT NULL, -- For device-to-device encryption
    capabilities JSONB DEFAULT '[]'::jsonb, -- ['biometric', 'clipboard', 'files', 'remote_control']
    settings JSONB DEFAULT '{}'::jsonb,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    device_status VARCHAR(20) DEFAULT 'active', -- 'active', 'revoked', 'suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_device_type CHECK (device_type IN ('ios', 'android', 'macos', 'windows')),
    CONSTRAINT valid_device_status CHECK (device_status IN ('active', 'revoked', 'suspended'))
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_unique_id ON devices(unique_identifier);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);
CREATE INDEX idx_devices_capabilities ON devices USING GIN(capabilities);
```

**Capabilities JSON Structure:**
```json
{
  "biometric": true,
  "clipboard": true,
  "files": true,
  "remote_control": true,
  "contacts": false,
  "screen_share": true
}
```

**Settings JSON Structure:**
```json
{
  "clipboard_sync_enabled": true,
  "auto_download_files": true,
  "accept_remote_control": true,
  "notification_preferences": {
    "file_transfer": true,
    "remote_control_request": true,
    "device_online": false
  },
  "theme": "dark",
  "language": "en"
}
```

---

### Device Trust Relationships Table

```sql
CREATE TABLE device_trust (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    target_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    trust_level VARCHAR(20) DEFAULT 'full', -- 'full', 'limited', 'revoked'
    permissions JSONB DEFAULT '[]'::jsonb, -- ['file_transfer', 'clipboard', 'remote_control']
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT no_self_trust CHECK (source_device_id != target_device_id),
    CONSTRAINT valid_trust_level CHECK (trust_level IN ('full', 'limited', 'revoked')),
    CONSTRAINT unique_device_pair UNIQUE (source_device_id, target_device_id)
);

CREATE INDEX idx_device_trust_source ON device_trust(source_device_id);
CREATE INDEX idx_device_trust_target ON device_trust(target_device_id);
```

**Permissions JSON Structure:**
```json
["file_transfer", "clipboard", "remote_control", "contacts"]
```

---

### Sessions Table

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    access_token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    access_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_session_status CHECK (session_status IN ('active', 'expired', 'revoked'))
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_device_id ON sessions(device_id);
CREATE INDEX idx_sessions_access_token ON sessions(access_token_hash);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expiry ON sessions(access_token_expires_at, refresh_token_expires_at);
```

---

### Files Table

```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64) NOT NULL, -- SHA-256
    storage_key TEXT NOT NULL, -- S3 object key
    storage_bucket VARCHAR(100) NOT NULL,
    encryption_key_id UUID, -- Reference to encryption key in Vault
    upload_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'uploading', 'completed', 'failed', 'deleted'
    upload_progress INTEGER DEFAULT 0, -- 0-100
    metadata JSONB DEFAULT '{}'::jsonb,
    virus_scan_status VARCHAR(20), -- 'pending', 'clean', 'infected', 'failed'
    virus_scan_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for permanent files

    CONSTRAINT valid_upload_status CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed', 'deleted')),
    CONSTRAINT valid_virus_scan CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'failed')),
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_progress CHECK (upload_progress >= 0 AND upload_progress <= 100)
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_source_device ON files(source_device_id);
CREATE INDEX idx_files_hash ON files(file_hash);
CREATE INDEX idx_files_status ON files(upload_status);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_expires_at ON files(expires_at) WHERE expires_at IS NOT NULL;
```

**Metadata JSON Structure:**
```json
{
  "original_path": "/Users/john/Documents/report.pdf",
  "thumbnail_url": "https://cdn.example.com/thumbnails/...",
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "tags": ["work", "important"]
}
```

---

### File Shares Table

```sql
CREATE TABLE file_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    target_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    share_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'transferred', 'failed', 'cancelled'
    transfer_progress INTEGER DEFAULT 0,
    bytes_transferred BIGINT DEFAULT 0,
    transfer_speed_bps BIGINT, -- Bytes per second
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_share_status CHECK (share_status IN ('pending', 'transferred', 'failed', 'cancelled')),
    CONSTRAINT valid_transfer_progress CHECK (transfer_progress >= 0 AND transfer_progress <= 100)
);

CREATE INDEX idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX idx_file_shares_source_device ON file_shares(source_device_id);
CREATE INDEX idx_file_shares_target_device ON file_shares(target_device_id);
CREATE INDEX idx_file_shares_status ON file_shares(share_status);
```

---

### Clipboard Sync Table

```sql
CREATE TABLE clipboard_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- 'text', 'image', 'file', 'url'
    content_text TEXT, -- For text/url
    content_data BYTEA, -- For small images
    content_file_id UUID REFERENCES files(id), -- For large content
    content_hash VARCHAR(64) NOT NULL,
    content_size INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Auto-expire after 24 hours

    CONSTRAINT valid_content_type CHECK (content_type IN ('text', 'image', 'file', 'url')),
    CONSTRAINT content_size_limit CHECK (content_size <= 10485760) -- 10MB limit
);

CREATE INDEX idx_clipboard_user_id ON clipboard_sync(user_id);
CREATE INDEX idx_clipboard_source_device ON clipboard_sync(source_device_id);
CREATE INDEX idx_clipboard_created_at ON clipboard_sync(created_at);
CREATE INDEX idx_clipboard_expires_at ON clipboard_sync(expires_at);
```

---

### Remote Control Sessions Table

```sql
CREATE TABLE remote_control_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    controller_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    controlled_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    session_mode VARCHAR(20) NOT NULL, -- 'view_only', 'view_and_control'
    session_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'ended', 'denied', 'failed'
    connection_type VARCHAR(20), -- 'p2p', 'relayed'
    webrtc_offer TEXT,
    webrtc_answer TEXT,
    ice_candidates JSONB DEFAULT '[]'::jsonb,
    quality_settings JSONB DEFAULT '{}'::jsonb,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    end_reason VARCHAR(50), -- 'user_stopped', 'timeout', 'error', 'denied'
    error_message TEXT,

    CONSTRAINT valid_session_mode CHECK (session_mode IN ('view_only', 'view_and_control')),
    CONSTRAINT valid_session_status CHECK (session_status IN ('pending', 'active', 'ended', 'denied', 'failed')),
    CONSTRAINT valid_connection_type CHECK (connection_type IN ('p2p', 'relayed')),
    CONSTRAINT no_self_control CHECK (controller_device_id != controlled_device_id)
);

CREATE INDEX idx_remote_sessions_user_id ON remote_control_sessions(user_id);
CREATE INDEX idx_remote_sessions_controller ON remote_control_sessions(controller_device_id);
CREATE INDEX idx_remote_sessions_controlled ON remote_control_sessions(controlled_device_id);
CREATE INDEX idx_remote_sessions_status ON remote_control_sessions(session_status);
CREATE INDEX idx_remote_sessions_requested_at ON remote_control_sessions(requested_at);
```

**Quality Settings JSON Structure:**
```json
{
  "resolution": "1920x1080",
  "fps": 30,
  "bitrate": 2000000,
  "codec": "h264"
}
```

---

### Biometric Approval Requests Table

```sql
CREATE TABLE biometric_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requesting_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    approving_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL, -- 'login', 'file_transfer', 'remote_control', 'sensitive_operation'
    request_context JSONB DEFAULT '{}'::jsonb,
    approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'expired'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Typically 2 minutes
    biometric_verified BOOLEAN,

    CONSTRAINT valid_approval_status CHECK (approval_status IN ('pending', 'approved', 'denied', 'expired'))
);

CREATE INDEX idx_biometric_user_id ON biometric_approvals(user_id);
CREATE INDEX idx_biometric_requesting_device ON biometric_approvals(requesting_device_id);
CREATE INDEX idx_biometric_approving_device ON biometric_approvals(approving_device_id);
CREATE INDEX idx_biometric_status ON biometric_approvals(approval_status);
CREATE INDEX idx_biometric_expires_at ON biometric_approvals(expires_at);
```

**Request Context JSON Structure:**
```json
{
  "action": "login_to_new_device",
  "device_name": "MacBook Pro",
  "ip_address": "192.168.1.10",
  "location": "San Francisco, CA",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- 'auth', 'device', 'file', 'clipboard', 'remote_control', 'settings'
    event_severity VARCHAR(20) DEFAULT 'info', -- 'debug', 'info', 'warning', 'error', 'critical'
    event_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    result VARCHAR(20), -- 'success', 'failure', 'partial'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_event_category CHECK (event_category IN ('auth', 'device', 'file', 'clipboard', 'remote_control', 'settings', 'security')),
    CONSTRAINT valid_severity CHECK (event_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_result CHECK (result IN ('success', 'failure', 'partial'))
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_device_id ON audit_logs(device_id);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_category ON audit_logs(event_category);
CREATE INDEX idx_audit_severity ON audit_logs(event_severity);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Partition by month for better performance
CREATE TABLE audit_logs_partitioned (LIKE audit_logs INCLUDING ALL) PARTITION BY RANGE (created_at);
```

**Event Data Examples:**

Login Event:
```json
{
  "method": "oauth_google",
  "device_name": "iPhone 14",
  "new_device": true
}
```

File Transfer Event:
```json
{
  "file_name": "document.pdf",
  "file_size": 2048576,
  "source_device": "iPhone",
  "target_device": "MacBook",
  "duration_ms": 3200
}
```

---

### Contacts Sync Table (Optional Feature)

```sql
CREATE TABLE contacts_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    contact_data JSONB NOT NULL,
    contact_hash VARCHAR(64) NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_sync_status CHECK (sync_status IN ('synced', 'pending', 'conflict', 'deleted'))
);

CREATE INDEX idx_contacts_user_id ON contacts_sync(user_id);
CREATE INDEX idx_contacts_hash ON contacts_sync(contact_hash);
CREATE INDEX idx_contacts_source_device ON contacts_sync(source_device_id);
```

**Contact Data JSON Structure:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "Acme Inc",
  "photo_url": "https://...",
  "custom_fields": {}
}
```

---

## Redis Data Structures

### Device Presence

**Key:** `presence:device:{device_id}`
**Type:** Hash
**TTL:** 5 minutes (refreshed by heartbeat)
**Structure:**
```json
{
  "user_id": "uuid",
  "device_name": "iPhone 14",
  "status": "online",
  "last_seen": "2025-01-15T10:30:00Z",
  "ip_address": "192.168.1.10"
}
```

### User Online Devices

**Key:** `user:online:{user_id}`
**Type:** Set
**Members:** Device IDs
**TTL:** None (managed by presence updates)

### Active WebSocket Connections

**Key:** `ws:device:{device_id}`
**Type:** String
**Value:** WebSocket server ID
**TTL:** 5 minutes

### File Transfer Progress

**Key:** `transfer:progress:{transfer_id}`
**Type:** Hash
**TTL:** 24 hours
**Structure:**
```json
{
  "file_id": "uuid",
  "source_device": "uuid",
  "target_device": "uuid",
  "progress": 45,
  "bytes_transferred": 2048576,
  "total_bytes": 4567890,
  "speed_bps": 524288,
  "status": "transferring"
}
```

### Rate Limiting

**Key:** `ratelimit:{endpoint}:{user_id}:{minute}`
**Type:** Counter
**TTL:** 1 minute
**Value:** Request count

### Session Tokens (Short-lived Cache)

**Key:** `session:token:{access_token_hash}`
**Type:** Hash
**TTL:** 15 minutes (access token expiry)
**Structure:**
```json
{
  "user_id": "uuid",
  "device_id": "uuid",
  "session_id": "uuid",
  "scopes": ["read", "write"]
}
```

### Pub/Sub Channels

- `user:{user_id}:events` - User-specific events
- `device:{device_id}:events` - Device-specific events
- `broadcast:all` - System-wide announcements
- `file:transfer:{transfer_id}` - File transfer events

---

## TypeScript Type Definitions

### User Types

```typescript
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string;
  displayName?: string;
  avatarUrl?: string;
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
  accountStatus: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata: Record<string, any>;
}

export interface CreateUserDto {
  email: string;
  password?: string;
  displayName?: string;
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
}
```

### Device Types

```typescript
export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: 'ios' | 'android' | 'macos' | 'windows';
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
  uniqueIdentifier: string;
  publicKey: string;
  capabilities: DeviceCapabilities;
  settings: DeviceSettings;
  lastSeenAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceStatus: 'active' | 'revoked' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceCapabilities {
  biometric: boolean;
  clipboard: boolean;
  files: boolean;
  remoteControl: boolean;
  contacts: boolean;
  screenShare: boolean;
}

export interface DeviceSettings {
  clipboardSyncEnabled: boolean;
  autoDownloadFiles: boolean;
  acceptRemoteControl: boolean;
  notificationPreferences: {
    fileTransfer: boolean;
    remoteControlRequest: boolean;
    deviceOnline: boolean;
  };
  theme: 'dark' | 'light' | 'auto';
  language: string;
}

export interface RegisterDeviceDto {
  deviceName: string;
  deviceType: 'ios' | 'android' | 'macos' | 'windows';
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
  uniqueIdentifier: string;
  publicKey: string;
  capabilities: DeviceCapabilities;
}
```

### File Types

```typescript
export interface File {
  id: string;
  userId: string;
  sourceDeviceId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileHash: string;
  storageKey: string;
  storageBucket: string;
  encryptionKeyId?: string;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed' | 'deleted';
  uploadProgress: number;
  metadata: FileMetadata;
  virusScanStatus?: 'pending' | 'clean' | 'infected' | 'failed';
  virusScanResult?: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface FileMetadata {
  originalPath?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  tags?: string[];
}

export interface InitiateUploadDto {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileHash: string;
  targetDeviceId?: string;
  metadata?: FileMetadata;
}

export interface CompleteUploadDto {
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}
```

### Session Types

```typescript
export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionStatus: 'active' | 'expired' | 'revoked';
  createdAt: Date;
  lastUsedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

### Remote Control Types

```typescript
export interface RemoteControlSession {
  id: string;
  userId: string;
  controllerDeviceId: string;
  controlledDeviceId: string;
  sessionMode: 'view_only' | 'view_and_control';
  sessionStatus: 'pending' | 'active' | 'ended' | 'denied' | 'failed';
  connectionType?: 'p2p' | 'relayed';
  webrtcOffer?: string;
  webrtcAnswer?: string;
  iceCandidates: RTCIceCandidateInit[];
  qualitySettings: QualitySettings;
  requestedAt: Date;
  approvedAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  endReason?: string;
  errorMessage?: string;
}

export interface QualitySettings {
  resolution: string;
  fps: number;
  bitrate: number;
  codec: string;
}

export interface RequestRemoteControlDto {
  targetDeviceId: string;
  mode: 'view_only' | 'view_and_control';
}
```

### Real-Time Event Types

```typescript
export enum DeviceEvent {
  ONLINE = 'device.online',
  OFFLINE = 'device.offline',
  IDLE = 'device.idle',
  REGISTERED = 'device.registered',
  REMOVED = 'device.removed',
}

export enum FileEvent {
  TRANSFER_INITIATED = 'file.transfer.initiated',
  TRANSFER_PROGRESS = 'file.transfer.progress',
  TRANSFER_COMPLETED = 'file.transfer.completed',
  TRANSFER_FAILED = 'file.transfer.failed',
  FILE_AVAILABLE = 'file.available',
}

export enum RemoteControlEvent {
  REQUEST = 'remote.control.request',
  APPROVED = 'remote.control.approved',
  DENIED = 'remote.control.denied',
  SESSION_START = 'remote.control.session_start',
  SESSION_END = 'remote.control.session_end',
}

export enum ClipboardEvent {
  SYNC = 'clipboard.sync',
}

export interface EventPayload<T = any> {
  eventType: string;
  timestamp: Date;
  deviceId?: string;
  userId?: string;
  data: T;
}
```

---

## Validation Rules

### Email Validation
- Must match RFC 5322 standard
- Maximum length: 255 characters
- Must be unique per user

### Password Requirements
- Minimum length: 12 characters
- Must contain: uppercase, lowercase, number, special character
- Not in common password list
- Hashed with Argon2id (time=3, memory=65536, parallelism=4)

### File Upload Constraints
- Maximum file size: 5GB per file
- Maximum concurrent uploads per device: 3
- Supported file types: configurable via environment
- Required virus scan before availability

### Rate Limits
- Login attempts: 5 per minute per IP
- API requests: 1000 per minute per user
- File uploads: 10 per hour per device
- WebSocket messages: 100 per second per connection

### Data Retention
- Audit logs: 90 days
- Clipboard history: 24 hours
- Temporary files: 7 days
- Deleted user data: 30 days (soft delete)

---

This comprehensive data model provides a solid foundation for all data operations in the Universal Device Connector system, with proper constraints, indexing, and type safety.
