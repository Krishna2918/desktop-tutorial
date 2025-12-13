import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

export class EncryptionService {
  private readonly algorithm: string;
  private readonly key: Buffer;
  private readonly ivLength = 16; // For AES, this is always 16

  constructor() {
    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';

    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }

    // Convert base64 key to buffer
    this.key = Buffer.from(keyString, 'base64');

    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
    }
  }

  /**
   * Encrypt a string value
   * Returns base64 encoded string in format: iv:authTag:encryptedData
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // For GCM mode, get the auth tag
    const authTag = (cipher as any).getAuthTag();

    // Combine iv, authTag, and encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt a string value
   * Expects base64 encoded string in format: iv:authTag:encryptedData
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return '';
    }

    try {
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract iv, authTag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + 16);
      const encrypted = combined.subarray(this.ivLength + 16);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt an object by converting to JSON first
   */
  encryptObject<T>(obj: T): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt and parse JSON object
   */
  decryptObject<T>(encryptedData: string): T {
    const json = this.decrypt(encryptedData);
    return JSON.parse(json);
  }

  /**
   * Hash a password using bcrypt-compatible method
   * Note: Use bcrypt library for actual password hashing
   * This is for other one-way hashing needs
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify a hash
   */
  verifyHash(data: string, hashedData: string): boolean {
    const [salt, originalHash] = hashedData.split(':');
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
    return hash.toString('hex') === originalHash;
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate a cryptographically secure random key
   */
  generateKey(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('base64');
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
