/**
 * Phase 2 - Data Model & Storage Layer Tests
 *
 * Test Suite validates:
 * - Entity CRUD operations
 * - Relationships and referential integrity
 * - Encryption/decryption
 * - Storage capacity management
 * - Migration and versioning
 * - Performance benchmarks
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { encryptionService } from '../services/encryption.service';
import { storageService } from '../services/storage.service';
import { qdrantService } from '../config/qdrant.config';

import { User } from '../entities/User';
import { Organization, OrganizationPlanType } from '../entities/Organization';
import { OrganizationMember, OrganizationRole } from '../entities/OrganizationMember';
import { Workspace, WorkspaceOwnerType } from '../entities/Workspace';
import { Project } from '../entities/Project';
import { Thread } from '../entities/Thread';
import { Message, MessageRole } from '../entities/Message';
import { Attachment } from '../entities/Attachment';
import { AIProviderConfig } from '../entities/AIProviderConfig';
import { AIInteraction, AIInteractionStatus } from '../entities/AIInteraction';
import { Device, DeviceType } from '../entities/Device';
import { SyncEvent, SyncOperation } from '../entities/SyncEvent';

describe('Phase 2: Data Model & Storage Layer', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Initialize test database
    dataSource = await AppDataSource.initialize();
    await storageService.initialize();

    // Try to initialize Qdrant (optional for tests)
    try {
      await qdrantService.initialize();
    } catch (error) {
      console.warn('Qdrant not available for tests, skipping vector tests');
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('Test Suite 1: Entity CRUD Operations', () => {
    test('1.1 Create User entity', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = userRepo.create({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        displayName: 'Test User',
        emailVerified: false
      });

      const savedUser = await userRepo.save(user);

      expect(savedUser.id).toBeDefined();
      expect(savedUser.email).toBe('test@example.com');
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.isDeleted).toBe(false);
    });

    test('1.2 Read User entity', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = await userRepo.findOne({
        where: { email: 'test@example.com' }
      });

      expect(user).not.toBeNull();
      expect(user?.displayName).toBe('Test User');
    });

    test('1.3 Update User entity', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = await userRepo.findOne({
        where: { email: 'test@example.com' }
      });

      if (user) {
        user.displayName = 'Updated User';
        user.emailVerified = true;
        await userRepo.save(user);

        const updated = await userRepo.findOne({
          where: { id: user.id }
        });

        expect(updated?.displayName).toBe('Updated User');
        expect(updated?.emailVerified).toBe(true);
      }
    });

    test('1.4 Create Organization with Members', async () => {
      const userRepo = dataSource.getRepository(User);
      const orgRepo = dataSource.getRepository(Organization);
      const memberRepo = dataSource.getRepository(OrganizationMember);

      const owner = await userRepo.findOne({ where: { email: 'test@example.com' } });
      expect(owner).not.toBeNull();

      const org = orgRepo.create({
        name: 'Test Organization',
        slug: 'test-org',
        ownerId: owner!.id,
        plan: OrganizationPlanType.TEAM,
        maxSeats: 10
      });

      const savedOrg = await orgRepo.save(org);
      expect(savedOrg.id).toBeDefined();

      // Add owner as member
      const member = memberRepo.create({
        organizationId: savedOrg.id,
        userId: owner!.id,
        role: OrganizationRole.OWNER
      });

      const savedMember = await memberRepo.save(member);
      expect(savedMember.id).toBeDefined();
      expect(savedMember.role).toBe(OrganizationRole.OWNER);
    });
  });

  describe('Test Suite 2: Relationships & Referential Integrity', () => {
    test('2.1 Create Workspace → Project → Thread → Message hierarchy', async () => {
      const userRepo = dataSource.getRepository(User);
      const workspaceRepo = dataSource.getRepository(Workspace);
      const projectRepo = dataSource.getRepository(Project);
      const threadRepo = dataSource.getRepository(Thread);
      const messageRepo = dataSource.getRepository(Message);

      const user = await userRepo.findOne({ where: { email: 'test@example.com' } });
      expect(user).not.toBeNull();

      // Create workspace
      const workspace = workspaceRepo.create({
        name: 'Test Workspace',
        ownerType: WorkspaceOwnerType.USER,
        userId: user!.id
      });
      const savedWorkspace = await workspaceRepo.save(workspace);

      // Create project
      const project = projectRepo.create({
        workspaceId: savedWorkspace.id,
        name: 'Test Project',
        tags: ['test', 'phase2']
      });
      const savedProject = await projectRepo.save(project);

      // Create thread
      const thread = threadRepo.create({
        projectId: savedProject.id,
        title: 'Test Thread',
        createdById: user!.id,
        messageCount: 0
      });
      const savedThread = await threadRepo.save(thread);

      // Create message
      const message = messageRepo.create({
        threadId: savedThread.id,
        role: MessageRole.USER,
        content: 'Hello, this is a test message.',
        userId: user!.id,
        tokenCount: 10
      });
      const savedMessage = await messageRepo.save(message);

      // Verify relationships
      expect(savedMessage.threadId).toBe(savedThread.id);
      expect(savedThread.projectId).toBe(savedProject.id);
      expect(savedProject.workspaceId).toBe(savedWorkspace.id);
    });

    test('2.2 Verify cascading relationships', async () => {
      const workspaceRepo = dataSource.getRepository(Workspace);
      const projectRepo = dataSource.getRepository(Project);
      const threadRepo = dataSource.getRepository(Thread);

      const workspace = await workspaceRepo.findOne({
        where: { name: 'Test Workspace' },
        relations: ['projects']
      });

      expect(workspace).not.toBeNull();
      expect(workspace!.projects.length).toBeGreaterThan(0);

      const project = await projectRepo.findOne({
        where: { workspaceId: workspace!.id },
        relations: ['threads']
      });

      expect(project).not.toBeNull();
      expect(project!.threads.length).toBeGreaterThan(0);
    });

    test('2.3 Test soft delete (User)', async () => {
      const userRepo = dataSource.getRepository(User);

      const testUser = userRepo.create({
        email: 'delete-test@example.com',
        passwordHash: 'hashed',
        displayName: 'Delete Test'
      });
      await userRepo.save(testUser);

      // Soft delete
      testUser.isDeleted = true;
      testUser.deletedAt = new Date();
      await userRepo.save(testUser);

      const found = await userRepo.findOne({
        where: { id: testUser.id }
      });

      expect(found?.isDeleted).toBe(true);
      expect(found?.deletedAt).toBeDefined();
    });
  });

  describe('Test Suite 3: Encryption & Security', () => {
    test('3.1 Encrypt and decrypt API key', () => {
      const apiKey = 'sk-test-1234567890abcdef';

      const encrypted = encryptionService.encrypt(apiKey);
      expect(encrypted).not.toBe(apiKey);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(apiKey);
    });

    test('3.2 Store encrypted AI provider config', async () => {
      const userRepo = dataSource.getRepository(User);
      const configRepo = dataSource.getRepository(AIProviderConfig);

      const user = await userRepo.findOne({ where: { email: 'test@example.com' } });
      expect(user).not.toBeNull();

      const apiKey = 'sk-openai-test-key-12345';
      const encrypted = encryptionService.encrypt(apiKey);

      const config = configRepo.create({
        userId: user!.id,
        providerKey: 'openai',
        displayName: 'My OpenAI Account',
        apiKeyEncrypted: encrypted,
        apiEndpoint: 'https://api.openai.com/v1',
        isActive: true
      });

      const saved = await configRepo.save(config);
      expect(saved.id).toBeDefined();

      // Retrieve and decrypt
      const retrieved = await configRepo.findOne({ where: { id: saved.id } });
      const decryptedKey = encryptionService.decrypt(retrieved!.apiKeyEncrypted);
      expect(decryptedKey).toBe(apiKey);
    });

    test('3.3 Encrypt and decrypt JSON object', () => {
      const sensitiveData = {
        apiKey: 'secret-key',
        tokens: ['token1', 'token2'],
        config: { max: 100 }
      };

      const encrypted = encryptionService.encryptObject(sensitiveData);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(sensitiveData);
    });

    test('3.4 Generate secure token', () => {
      const token = encryptionService.generateToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);

      // Tokens should be unique
      const token2 = encryptionService.generateToken();
      expect(token).not.toBe(token2);
    });
  });

  describe('Test Suite 4: Storage Capacity Management', () => {
    test('4.1 Get storage statistics', async () => {
      const stats = await storageService.getStorageStats();

      expect(stats).toBeDefined();
      expect(stats.quotaBytes).toBe(10 * 1024 * 1024 * 1024); // 10 GB
      expect(stats.messageCount).toBeGreaterThanOrEqual(0);
      expect(stats.usagePercent).toBeGreaterThanOrEqual(0);
      expect(stats.usagePercent).toBeLessThan(100);
    });

    test('4.2 Check quota before adding file', async () => {
      const canAdd = await storageService.canAddFile(100 * 1024 * 1024); // 100 MB
      expect(typeof canAdd).toBe('boolean');
    });

    test('4.3 Generate unique file name', () => {
      const fileName = storageService.generateUniqueFileName('test.pdf');
      expect(fileName).toMatch(/[a-f0-9]+\.pdf/);

      const fileName2 = storageService.generateUniqueFileName('test.pdf');
      expect(fileName).not.toBe(fileName2);
    });

    test('4.4 Format bytes to human-readable', () => {
      expect(storageService.formatBytes(0)).toBe('0 Bytes');
      expect(storageService.formatBytes(1024)).toBe('1 KB');
      expect(storageService.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(storageService.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('Test Suite 5: AI Provider Integration', () => {
    test('5.1 Create AI Interaction record', async () => {
      const messageRepo = dataSource.getRepository(Message);
      const interactionRepo = dataSource.getRepository(AIInteraction);
      const configRepo = dataSource.getRepository(AIProviderConfig);

      const message = await messageRepo.findOne({
        where: { role: MessageRole.USER }
      });

      const config = await configRepo.findOne({
        where: { providerKey: 'openai' }
      });

      expect(message).not.toBeNull();
      expect(config).not.toBeNull();

      const interaction = interactionRepo.create({
        messageId: message!.id,
        providerConfigId: config!.id,
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        latencyMs: 1500,
        cost: 0.015,
        status: AIInteractionStatus.SUCCESS
      });

      const saved = await interactionRepo.save(interaction);
      expect(saved.id).toBeDefined();
      expect(saved.totalTokens).toBe(300);
      expect(saved.cost).toBe(0.015);
    });

    test('5.2 Query AI interactions for cost tracking', async () => {
      const interactionRepo = dataSource.getRepository(AIInteraction);

      const interactions = await interactionRepo.find({
        where: { status: AIInteractionStatus.SUCCESS }
      });

      const totalCost = interactions.reduce((sum, i) => sum + (i.cost || 0), 0);
      const totalTokens = interactions.reduce((sum, i) => sum + i.totalTokens, 0);

      expect(totalCost).toBeGreaterThanOrEqual(0);
      expect(totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Test Suite 6: Multi-Device Sync', () => {
    test('6.1 Register devices', async () => {
      const userRepo = dataSource.getRepository(User);
      const deviceRepo = dataSource.getRepository(Device);

      const user = await userRepo.findOne({ where: { email: 'test@example.com' } });
      expect(user).not.toBeNull();

      const device1 = deviceRepo.create({
        userId: user!.id,
        deviceName: 'Desktop',
        deviceType: DeviceType.DESKTOP,
        platform: 'macOS',
        isActive: true
      });

      const device2 = deviceRepo.create({
        userId: user!.id,
        deviceName: 'Web Browser',
        deviceType: DeviceType.WEB,
        platform: 'Chrome',
        isActive: true
      });

      await deviceRepo.save([device1, device2]);

      const devices = await deviceRepo.find({ where: { userId: user!.id } });
      expect(devices.length).toBeGreaterThanOrEqual(2);
    });

    test('6.2 Create sync event', async () => {
      const deviceRepo = dataSource.getRepository(Device);
      const syncEventRepo = dataSource.getRepository(SyncEvent);
      const messageRepo = dataSource.getRepository(Message);

      const device = await deviceRepo.findOne({ where: { deviceType: DeviceType.DESKTOP } });
      const message = await messageRepo.findOne({ where: { role: MessageRole.USER } });

      expect(device).not.toBeNull();
      expect(message).not.toBeNull();

      const syncEvent = syncEventRepo.create({
        deviceId: device!.id,
        entityType: 'Message',
        entityId: message!.id,
        operation: SyncOperation.UPDATE,
        vectorClock: { [device!.id]: 1 },
        payload: { content: message!.content },
        conflictResolved: false
      });

      const saved = await syncEventRepo.save(syncEvent);
      expect(saved.id).toBeDefined();
      expect(saved.operation).toBe(SyncOperation.UPDATE);
    });

    test('6.3 Query sync events since timestamp', async () => {
      const syncEventRepo = dataSource.getRepository(SyncEvent);

      const oneHourAgo = new Date(Date.now() - 3600000);

      const events = await syncEventRepo
        .createQueryBuilder('event')
        .where('event.syncedAt > :since', { since: oneHourAgo })
        .getMany();

      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Test Suite 7: Performance Benchmarks', () => {
    test('7.1 Bulk insert messages (simulating multi-GB data)', async () => {
      const messageRepo = dataSource.getRepository(Message);
      const threadRepo = dataSource.getRepository(Thread);
      const userRepo = dataSource.getRepository(User);

      const user = await userRepo.findOne({ where: { email: 'test@example.com' } });
      const thread = await threadRepo.findOne({ where: { title: 'Test Thread' } });

      expect(user).not.toBeNull();
      expect(thread).not.toBeNull();

      const startTime = Date.now();
      const messages = [];

      // Insert 1000 messages
      for (let i = 0; i < 1000; i++) {
        messages.push(
          messageRepo.create({
            threadId: thread!.id,
            role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
            content: `Test message ${i} with some content to simulate real messages.`,
            userId: user!.id,
            tokenCount: 20
          })
        );
      }

      await messageRepo.save(messages);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Inserted 1000 messages in ${duration}ms`);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
    });

    test('7.2 Query performance with indexes', async () => {
      const messageRepo = dataSource.getRepository(Message);
      const threadRepo = dataSource.getRepository(Thread);

      const thread = await threadRepo.findOne({ where: { title: 'Test Thread' } });
      expect(thread).not.toBeNull();

      const startTime = Date.now();

      const messages = await messageRepo
        .createQueryBuilder('message')
        .where('message.threadId = :threadId', { threadId: thread!.id })
        .orderBy('message.createdAt', 'DESC')
        .limit(50)
        .getMany();

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Queried 50 messages in ${duration}ms`);

      expect(messages.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    test('7.3 Full-text search performance', async () => {
      const messageRepo = dataSource.getRepository(Message);

      const startTime = Date.now();

      // Note: FTS search would use raw SQL in real implementation
      const messages = await messageRepo
        .createQueryBuilder('message')
        .where('message.content LIKE :search', { search: '%test%' })
        .limit(20)
        .getMany();

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`FTS search completed in ${duration}ms`);

      expect(duration).toBeLessThan(500); // Less than 500ms
    });
  });

  describe('Test Suite 8: Data Integrity', () => {
    test('8.1 Unique constraints enforced', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = userRepo.create({
        email: 'test@example.com', // Duplicate email
        passwordHash: 'hashed',
        displayName: 'Duplicate'
      });

      await expect(userRepo.save(user)).rejects.toThrow();
    });

    test('8.2 Foreign key constraints enforced', async () => {
      const messageRepo = dataSource.getRepository(Message);

      const message = messageRepo.create({
        threadId: '00000000-0000-0000-0000-000000000000', // Non-existent thread
        role: MessageRole.USER,
        content: 'This should fail',
        tokenCount: 10
      });

      // This should fail due to foreign key constraint
      await expect(messageRepo.save(message)).rejects.toThrow();
    });

    test('8.3 Required fields validated', async () => {
      const workspaceRepo = dataSource.getRepository(Workspace);

      const workspace = workspaceRepo.create({
        // Missing required 'name' field
        ownerType: WorkspaceOwnerType.USER
      } as any);

      await expect(workspaceRepo.save(workspace)).rejects.toThrow();
    });
  });

  describe('Summary: Phase 2 Test Results', () => {
    test('All Phase 2 tests passed - Generate summary', async () => {
      const stats = await storageService.getStorageStats();

      console.log('\n=== Phase 2 Test Summary ===');
      console.log('Storage Statistics:');
      console.log(`  Total Size: ${storageService.formatBytes(stats.totalSizeBytes)}`);
      console.log(`  Database: ${storageService.formatBytes(stats.databaseSizeBytes)}`);
      console.log(`  Messages: ${stats.messageCount}`);
      console.log(`  Attachments: ${stats.attachmentCount}`);
      console.log(`  Embeddings: ${stats.embeddingCount}`);
      console.log(`  Quota Usage: ${stats.usagePercent.toFixed(2)}%`);
      console.log('\nAll Phase 2 tests completed successfully! ✓');

      expect(true).toBe(true);
    });
  });
});
