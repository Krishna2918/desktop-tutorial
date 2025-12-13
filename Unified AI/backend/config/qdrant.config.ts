import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';

dotenv.config();

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionPrefix: string;
}

export class QdrantService {
  private client: QdrantClient;
  private config: QdrantConfig;
  private initialized: boolean = false;

  constructor() {
    this.config = {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      collectionPrefix: process.env.QDRANT_COLLECTION_PREFIX || 'unified_ai'
    };

    this.client = new QdrantClient({
      url: this.config.url,
      apiKey: this.config.apiKey
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Test connection
      await this.client.getCollections();
      console.log('Qdrant connection established');

      // Create collections if they don't exist
      await this.createCollections();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  private async createCollections(): Promise<void> {
    const collections = [
      {
        name: `${this.config.collectionPrefix}_messages`,
        vectorSize: 1536, // OpenAI ada-002 embedding size
        distance: 'Cosine'
      },
      {
        name: `${this.config.collectionPrefix}_documents`,
        vectorSize: 1536,
        distance: 'Cosine'
      },
      {
        name: `${this.config.collectionPrefix}_attachments`,
        vectorSize: 1536,
        distance: 'Cosine'
      }
    ];

    for (const collectionConfig of collections) {
      try {
        const exists = await this.collectionExists(collectionConfig.name);

        if (!exists) {
          await this.client.createCollection(collectionConfig.name, {
            vectors: {
              size: collectionConfig.vectorSize,
              distance: collectionConfig.distance as 'Cosine' | 'Euclid' | 'Dot'
            },
            optimizers_config: {
              default_segment_number: 2
            },
            replication_factor: 1
          });
          console.log(`Created Qdrant collection: ${collectionConfig.name}`);
        }
      } catch (error) {
        console.error(`Error creating collection ${collectionConfig.name}:`, error);
      }
    }
  }

  private async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.client.getCollection(collectionName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Insert or update a vector embedding
   */
  async upsertEmbedding(
    collectionType: 'messages' | 'documents' | 'attachments',
    id: string,
    embedding: number[],
    payload: Record<string, any>
  ): Promise<void> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    await this.client.upsert(collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: embedding,
          payload
        }
      ]
    });
  }

  /**
   * Search for similar vectors
   */
  async searchSimilar(
    collectionType: 'messages' | 'documents' | 'attachments',
    queryVector: number[],
    limit: number = 10,
    filter?: Record<string, any>,
    scoreThreshold?: number
  ): Promise<Array<{ id: string; score: number; payload: Record<string, any> }>> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    const searchResult = await this.client.search(collectionName, {
      vector: queryVector,
      limit,
      filter: filter ? this.buildFilter(filter) : undefined,
      score_threshold: scoreThreshold,
      with_payload: true
    });

    return searchResult.map(result => ({
      id: result.id.toString(),
      score: result.score,
      payload: result.payload as Record<string, any>
    }));
  }

  /**
   * Delete a vector by ID
   */
  async deleteEmbedding(
    collectionType: 'messages' | 'documents' | 'attachments',
    id: string
  ): Promise<void> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    await this.client.delete(collectionName, {
      wait: true,
      points: [id]
    });
  }

  /**
   * Delete multiple vectors by IDs
   */
  async deleteManyEmbeddings(
    collectionType: 'messages' | 'documents' | 'attachments',
    ids: string[]
  ): Promise<void> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    await this.client.delete(collectionName, {
      wait: true,
      points: ids
    });
  }

  /**
   * Get collection info and stats
   */
  async getCollectionInfo(collectionType: 'messages' | 'documents' | 'attachments') {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;
    return await this.client.getCollection(collectionName);
  }

  /**
   * Build Qdrant filter from simple object
   */
  private buildFilter(filter: Record<string, any>): any {
    const conditions = Object.entries(filter).map(([key, value]) => ({
      key,
      match: { value }
    }));

    return {
      must: conditions
    };
  }

  /**
   * Batch upsert embeddings
   */
  async batchUpsertEmbeddings(
    collectionType: 'messages' | 'documents' | 'attachments',
    embeddings: Array<{
      id: string;
      embedding: number[];
      payload: Record<string, any>;
    }>
  ): Promise<void> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    const points = embeddings.map(item => ({
      id: item.id,
      vector: item.embedding,
      payload: item.payload
    }));

    await this.client.upsert(collectionName, {
      wait: true,
      points
    });
  }

  /**
   * Scroll through all points in a collection
   */
  async scrollCollection(
    collectionType: 'messages' | 'documents' | 'attachments',
    limit: number = 100,
    offset?: string
  ) {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    return await this.client.scroll(collectionName, {
      limit,
      offset: offset ? { offset } : undefined,
      with_payload: true,
      with_vector: false
    });
  }

  /**
   * Clear all points in a collection (for testing/development)
   */
  async clearCollection(collectionType: 'messages' | 'documents' | 'attachments'): Promise<void> {
    const collectionName = `${this.config.collectionPrefix}_${collectionType}`;

    await this.client.delete(collectionName, {
      wait: true,
      filter: {} // Empty filter matches all points
    });
  }

  getClient(): QdrantClient {
    return this.client;
  }
}

// Singleton instance
export const qdrantService = new QdrantService();
