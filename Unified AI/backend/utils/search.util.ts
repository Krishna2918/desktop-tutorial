/**
 * Full-Text Search Utility
 *
 * Provides FTS5-based full-text search functionality for messages and documents.
 * Works with SQLite FTS5 virtual tables created in data-source.ts
 */

import { DataSource } from 'typeorm';
import { Message } from '../entities/Message';

/**
 * Search result with ranking
 */
export interface SearchResult<T = any> {
  id: string;
  rank: number;
  snippet: string;
  entity: T;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Minimum rank threshold (0-1) */
  minRank?: number;
  /** Include deleted items */
  includeDeleted?: boolean;
  /** Specific thread ID to search within */
  threadId?: string;
  /** Specific user ID to filter by */
  userId?: string;
  /** Date range filter */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Search messages using FTS5
 */
export async function searchMessages(
  dataSource: DataSource,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult<Message>[]> {
  const {
    limit = 50,
    offset = 0,
    minRank = 0,
    includeDeleted = false,
    threadId,
    userId,
    dateRange
  } = options;

  // Sanitize query for FTS5
  const sanitizedQuery = sanitizeFTS5Query(query);

  if (!sanitizedQuery) {
    return [];
  }

  // Build the query
  let sql = `
    SELECT
      m.id,
      m.threadId,
      m.userId,
      m.role,
      m.content,
      m.contentType,
      m.metadata,
      m.tokenCount,
      m.createdAt,
      m.editedAt,
      m.isDeleted,
      m.deletedAt,
      m.providerId,
      m.model,
      m.parentId,
      fts.rank,
      snippet(messages_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
    FROM messages_fts AS fts
    INNER JOIN messages AS m ON fts.id = m.id
    WHERE messages_fts MATCH ?
  `;

  const params: any[] = [sanitizedQuery];

  // Add filters
  if (!includeDeleted) {
    sql += ` AND m.isDeleted = 0`;
  }

  if (threadId) {
    sql += ` AND m.threadId = ?`;
    params.push(threadId);
  }

  if (userId) {
    sql += ` AND m.userId = ?`;
    params.push(userId);
  }

  if (dateRange?.from) {
    sql += ` AND m.createdAt >= ?`;
    params.push(dateRange.from.toISOString());
  }

  if (dateRange?.to) {
    sql += ` AND m.createdAt <= ?`;
    params.push(dateRange.to.toISOString());
  }

  // Order by rank
  sql += ` ORDER BY fts.rank DESC`;

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Execute query
  const results = await dataSource.query(sql, params);

  // Filter by minimum rank and convert to SearchResult
  return results
    .filter((r: any) => Math.abs(r.rank) >= minRank)
    .map((r: any) => {
      const message = new Message();
      message.id = r.id;
      message.threadId = r.threadId;
      message.userId = r.userId;
      message.role = r.role;
      message.content = r.content;
      message.contentType = r.contentType;
      message.metadata = r.metadata ? JSON.parse(r.metadata) : null;
      message.tokenCount = r.tokenCount;
      message.createdAt = new Date(r.createdAt);
      message.editedAt = r.editedAt ? new Date(r.editedAt) : undefined;
      message.isDeleted = r.isDeleted === 1;
      message.deletedAt = r.deletedAt ? new Date(r.deletedAt) : undefined;
      message.providerId = r.providerId;
      message.model = r.model;
      message.parentId = r.parentId;

      return {
        id: r.id,
        rank: Math.abs(r.rank), // FTS5 rank is negative
        snippet: r.snippet,
        entity: message
      };
    });
}

/**
 * Sanitize FTS5 query to prevent syntax errors
 */
export function sanitizeFTS5Query(query: string): string {
  if (!query || query.trim() === '') {
    return '';
  }

  // Remove or escape special FTS5 characters
  let sanitized = query
    // Remove quotes (we'll add them back if needed)
    .replace(/["']/g, '')
    // Remove FTS5 operators that could cause issues
    .replace(/[()]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) {
    return '';
  }

  // Split into terms
  const terms = sanitized.split(/\s+/);

  // Build FTS5 query with prefix matching
  // Each term gets a wildcard suffix for prefix matching
  const ftsQuery = terms
    .filter(term => term.length > 0)
    .map(term => {
      // Escape any remaining special characters
      term = term.replace(/[^a-zA-Z0-9]/g, '');

      if (term.length === 0) {
        return null;
      }

      // Add prefix wildcard for partial matching
      return `${term}*`;
    })
    .filter(term => term !== null)
    .join(' OR ');

  return ftsQuery;
}

/**
 * Build a phrase query for exact matching
 */
export function buildPhraseQuery(phrase: string): string {
  const sanitized = phrase.replace(/["']/g, '').trim();

  if (!sanitized) {
    return '';
  }

  // Wrap in quotes for phrase matching
  return `"${sanitized}"`;
}

/**
 * Build a boolean query with AND/OR operators
 */
export interface BooleanQueryOptions {
  mustHave?: string[];
  shouldHave?: string[];
  mustNotHave?: string[];
}

export function buildBooleanQuery(options: BooleanQueryOptions): string {
  const parts: string[] = [];

  // Must have (AND)
  if (options.mustHave && options.mustHave.length > 0) {
    const mustTerms = options.mustHave
      .map(term => sanitizeFTS5Query(term))
      .filter(term => term.length > 0)
      .join(' AND ');

    if (mustTerms) {
      parts.push(`(${mustTerms})`);
    }
  }

  // Should have (OR)
  if (options.shouldHave && options.shouldHave.length > 0) {
    const shouldTerms = options.shouldHave
      .map(term => sanitizeFTS5Query(term))
      .filter(term => term.length > 0)
      .join(' OR ');

    if (shouldTerms) {
      parts.push(`(${shouldTerms})`);
    }
  }

  // Must not have (NOT)
  if (options.mustNotHave && options.mustNotHave.length > 0) {
    const notTerms = options.mustNotHave
      .map(term => sanitizeFTS5Query(term))
      .filter(term => term.length > 0)
      .map(term => `NOT ${term}`)
      .join(' AND ');

    if (notTerms) {
      parts.push(`(${notTerms})`);
    }
  }

  return parts.join(' AND ');
}

/**
 * Search with highlighting
 */
export async function searchWithHighlights(
  dataSource: DataSource,
  query: string,
  options: SearchOptions = {}
): Promise<Array<SearchResult<Message> & { highlights: string[] }>> {
  const results = await searchMessages(dataSource, query, options);

  // Extract highlights from snippets
  return results.map(result => {
    const highlights: string[] = [];
    const snippetMatches = result.snippet.match(/<mark>(.*?)<\/mark>/g);

    if (snippetMatches) {
      highlights.push(
        ...snippetMatches.map(match =>
          match.replace(/<\/?mark>/g, '')
        )
      );
    }

    return {
      ...result,
      highlights
    };
  });
}

/**
 * Count search results (without fetching all data)
 */
export async function countSearchResults(
  dataSource: DataSource,
  query: string,
  options: SearchOptions = {}
): Promise<number> {
  const {
    includeDeleted = false,
    threadId,
    userId,
    dateRange
  } = options;

  const sanitizedQuery = sanitizeFTS5Query(query);

  if (!sanitizedQuery) {
    return 0;
  }

  let sql = `
    SELECT COUNT(*) as count
    FROM messages_fts AS fts
    INNER JOIN messages AS m ON fts.id = m.id
    WHERE messages_fts MATCH ?
  `;

  const params: any[] = [sanitizedQuery];

  if (!includeDeleted) {
    sql += ` AND m.isDeleted = 0`;
  }

  if (threadId) {
    sql += ` AND m.threadId = ?`;
    params.push(threadId);
  }

  if (userId) {
    sql += ` AND m.userId = ?`;
    params.push(userId);
  }

  if (dateRange?.from) {
    sql += ` AND m.createdAt >= ?`;
    params.push(dateRange.from.toISOString());
  }

  if (dateRange?.to) {
    sql += ` AND m.createdAt <= ?`;
    params.push(dateRange.to.toISOString());
  }

  const result = await dataSource.query(sql, params);
  return result[0]?.count || 0;
}

/**
 * Get suggested search terms based on partial input
 */
export async function getSuggestedTerms(
  dataSource: DataSource,
  partialTerm: string,
  limit: number = 10
): Promise<string[]> {
  const sanitized = partialTerm.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  if (sanitized.length < 2) {
    return [];
  }

  // This is a simple implementation
  // In production, you might want a dedicated terms table
  const sql = `
    SELECT DISTINCT substr(content, instr(lower(content), ?), 20) as term
    FROM messages
    WHERE lower(content) LIKE ?
    AND isDeleted = 0
    LIMIT ?
  `;

  const results = await dataSource.query(sql, [
    sanitized,
    `%${sanitized}%`,
    limit
  ]);

  return results
    .map((r: any) => r.term)
    .filter((term: string) => term && term.length > 0);
}

/**
 * Rebuild FTS index for all messages
 * Should be called if FTS index gets out of sync
 */
export async function rebuildMessagesFTSIndex(
  dataSource: DataSource
): Promise<void> {
  await dataSource.query(`DELETE FROM messages_fts;`);

  await dataSource.query(`
    INSERT INTO messages_fts(rowid, id, content)
    SELECT rowid, id, content FROM messages;
  `);
}

/**
 * Optimize FTS index (run periodically)
 */
export async function optimizeFTSIndex(
  dataSource: DataSource
): Promise<void> {
  await dataSource.query(`INSERT INTO messages_fts(messages_fts) VALUES('optimize');`);
}
