import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { entities } from '../entities';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isSQLite = process.env.DATABASE_TYPE !== 'postgres';

// SQLite configuration (local-first)
const sqliteConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './data/app.db',
  entities,
  synchronize: !isProduction,
  logging: process.env.LOG_LEVEL === 'debug' ? ['query', 'error'] : ['error'],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  migrationsRun: true,
  // SQLite optimizations
  extra: {
    // Enable WAL mode for better concurrency
    pragma: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = -64000', // 64MB cache
      'PRAGMA temp_store = MEMORY',
      'PRAGMA mmap_size = 268435456', // 256MB mmap
      'PRAGMA page_size = 4096'
    ]
  }
};

// PostgreSQL configuration (cloud deployment)
const postgresConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'unified_ai',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'unified_ai_hub',
  entities,
  synchronize: false, // Always use migrations in production
  logging: process.env.LOG_LEVEL === 'debug' ? ['query', 'error'] : ['error'],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  migrationsRun: true,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  // PostgreSQL optimizations
  extra: {
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
};

const config = isSQLite ? sqliteConfig : postgresConfig;

export const AppDataSource = new DataSource(config);

// Initialize data source
export async function initializeDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');

    // Create FTS5 indexes for SQLite
    if (isSQLite && AppDataSource.isInitialized) {
      await createFullTextSearchIndexes(AppDataSource);
    }
  }
  return AppDataSource;
}

// Create FTS5 indexes for full-text search (SQLite only)
async function createFullTextSearchIndexes(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    // Messages FTS index
    await queryRunner.query(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        content,
        content=messages,
        content_rowid=rowid
      );
    `);

    // Trigger to keep FTS index in sync
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, id, content)
        VALUES (NEW.rowid, NEW.id, NEW.content);
      END;
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        UPDATE messages_fts SET content = NEW.content WHERE rowid = NEW.rowid;
      END;
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE rowid = OLD.rowid;
      END;
    `);

    // Documents FTS index
    await queryRunner.query(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        content=documents,
        content_rowid=rowid
      );
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, id, title, content)
        VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content);
      END;
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
        UPDATE documents_fts SET title = NEW.title, content = NEW.content WHERE rowid = NEW.rowid;
      END;
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
        DELETE FROM documents_fts WHERE rowid = OLD.rowid;
      END;
    `);

    console.log('Full-text search indexes created successfully');
  } catch (error) {
    // Indexes might already exist, log but don't fail
    console.log('FTS indexes already exist or error creating them:', error);
  } finally {
    await queryRunner.release();
  }
}

export default AppDataSource;
