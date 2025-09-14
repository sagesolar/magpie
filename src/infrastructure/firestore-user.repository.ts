// Firestore User Repository - Infrastructure Layer
// Follows Single Responsibility and Dependency Inversion principles

import { Firestore, DocumentData } from '@google-cloud/firestore';
import { User, CreateUserDto, UpdateUserDto, DEFAULT_USER_PREFERENCES } from '../domain/user.types';
import { logger } from '../utils/logger';

export interface UserRepository {
  create(user: CreateUserDto): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, updates: UpdateUserDto): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

export class FirestoreUserRepository implements UserRepository {
  private db: Firestore;
  private collection: string = 'users';

  constructor(db: Firestore, databaseId?: string) {
    this.db = db;
    if (databaseId) {
      // Use specific database if provided
      this.db = new Firestore({ databaseId });
    }
  }

  async create(userData: CreateUserDto): Promise<User> {
    try {
      const now = new Date();
      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        profilePictureUrl: userData.profilePictureUrl,
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          ...userData.preferences,
        },
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };

      // Store in Firestore using the user ID as document ID
      const firestoreData = {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString(),
      };

      await this.db.collection(this.collection).doc(user.id).set(firestoreData);

      logger.info(`User created successfully: ${user.email} (${user.id})`);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const doc = await this.db.collection(this.collection).doc(id).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      return this.mapDocumentToUser(data);
    } catch (error) {
      logger.error(`Failed to find user by ID ${id}:`, error);
      throw new Error(
        `Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const querySnapshot = await this.db
        .collection(this.collection)
        .where('email', '==', email)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return this.mapDocumentToUser(data);
    } catch (error) {
      logger.error(`Failed to find user by email ${email}:`, error);
      throw new Error(
        `Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async update(id: string, updates: UpdateUserDto): Promise<User | null> {
    try {
      const userRef = this.db.collection(this.collection).doc(id);
      const doc = await userRef.get();

      if (!doc.exists) {
        return null;
      }

      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await userRef.update(updateData);

      // Return updated user
      const updatedDoc = await userRef.get();
      const data = updatedDoc.data();

      if (!data) {
        return null;
      }

      logger.info(`User updated successfully: ${id}`);
      return this.mapDocumentToUser(data);
    } catch (error) {
      logger.error(`Failed to update user ${id}:`, error);
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      const userRef = this.db.collection(this.collection).doc(id);
      await userRef.update({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      logger.info(`Last login updated for user: ${id}`);
    } catch (error) {
      logger.error(`Failed to update last login for user ${id}:`, error);
      // Don't throw error for last login update failure - it's not critical
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const userRef = this.db.collection(this.collection).doc(id);
      const doc = await userRef.get();

      if (!doc.exists) {
        return false;
      }

      await userRef.delete();
      logger.info(`User deleted successfully: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete user ${id}:`, error);
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const doc = await this.db.collection(this.collection).doc(id).get();
      return doc.exists;
    } catch (error) {
      logger.error(`Failed to check user existence ${id}:`, error);
      throw new Error(
        `Failed to check user existence: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Helper method to map Firestore document data to User domain object
  private mapDocumentToUser(data: DocumentData): User {
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      profilePictureUrl: data.profilePictureUrl,
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        ...data.preferences,
      },
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : undefined,
    };
  }
}
