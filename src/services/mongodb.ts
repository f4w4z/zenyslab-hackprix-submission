/**
 * MongoDB Atlas Data API service for persisting simulation history.
 *
 * Uses the Atlas Data API (HTTP REST) — no Mongoose SDK needed.
 * Enable the Data API in your Atlas project and set environment variables.
 *
 * Docs: https://www.mongodb.com/docs/atlas/api/data-api/
 */

import { SimulationRecord } from '@/constants/mockData';

function getConfig() {
  const url = process.env.EXPO_PUBLIC_MONGODB_DATA_API_URL;
  const apiKey = process.env.EXPO_PUBLIC_MONGODB_API_KEY;
  const database = process.env.EXPO_PUBLIC_MONGODB_DATABASE ?? 'echo';
  const collection = process.env.EXPO_PUBLIC_MONGODB_COLLECTION ?? 'simulations';

  if (!url || !apiKey) {
    throw new Error(
      'Missing MongoDB Atlas Data API configuration. ' +
        'Please set EXPO_PUBLIC_MONGODB_DATA_API_URL and EXPO_PUBLIC_MONGODB_API_KEY in your .env file.'
    );
  }

  return { url, apiKey, database, collection };
}

async function mongoRequest<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { url, apiKey, database, collection } = getConfig();

  const response = await fetch(`${url}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      dataSource: 'Cluster0',
      database,
      collection,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`MongoDB Atlas API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

/** Strips internal fields that should not be stored in MongoDB */
function toDocument(record: SimulationRecord): Record<string, unknown> {
  const { mongoId, ...doc } = record;
  return {
    ...doc,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Saves a simulation record to MongoDB Atlas.
 * Returns the MongoDB-generated document ID (_id as string).
 */
export async function saveSimulation(record: SimulationRecord): Promise<string> {
  const result = await mongoRequest<{ insertedId: string }>('insertOne', {
    document: toDocument(record),
  });
  return result.insertedId;
}

/**
 * Retrieves all past simulations, sorted by timestamp descending (most recent first).
 * Returns an empty array if the collection doesn't exist or API is not configured.
 */
export async function listSimulations(): Promise<SimulationRecord[]> {
  try {
    const result = await mongoRequest<{ documents: SimulationRecord[] }>('find', {
      sort: { createdAt: -1 },
      limit: 50,
    });
    return result.documents.map((doc: any) => ({
      ...doc,
      mongoId: doc._id?.toString() ?? doc._id,
    }));
  } catch (error) {
    // If MongoDB is not configured, return empty (app works without it)
    console.warn('MongoDB listSimulations failed — using empty history:', error);
    return [];
  }
}

/**
 * Deletes a single simulation by its MongoDB document ID.
 */
export async function deleteSimulation(mongoId: string): Promise<void> {
  await mongoRequest('deleteOne', {
    filter: { _id: { $oid: mongoId } },
  });
}
