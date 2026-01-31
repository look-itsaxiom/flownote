import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// Mock firebase-admin before importing modules
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: 'test-app' }]),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

// Mock Firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(),
    doc: vi.fn(),
    runTransaction: vi.fn(),
  })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    increment: vi.fn((n: number) => ({ _increment: n })),
  },
}));

// Test data
const mockUser = {
  uid: 'user-123',
  email: 'test@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockOtherUser = {
  uid: 'other-user-456',
  email: 'other@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockNote = {
  id: 'note-1',
  name: 'Test Note',
  content: '# Test Content',
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockNotes = [
  mockNote,
  { id: 'note-2', name: 'Second Note', content: '## Second', order: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'note-3', name: 'Third Note', content: '### Third', order: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

describe('Notes API', () => {
  let app: Express;
  let mockVerifyIdToken: Mock;
  let mockFirestoreService: {
    getUserProfile: Mock;
    listNotes: Mock;
    getNote: Mock;
    createNote: Mock;
    updateNote: Mock;
    deleteNote: Mock;
    bulkSyncNotes: Mock;
  };

  beforeEach(async () => {
    vi.resetModules();

    // Setup auth mock
    mockVerifyIdToken = vi.fn();
    vi.doMock('firebase-admin/app', () => ({
      initializeApp: vi.fn(),
      getApps: vi.fn(() => [{ name: 'test-app' }]),
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({
        verifyIdToken: mockVerifyIdToken,
      })),
    }));

    // Setup Firestore service mock
    mockFirestoreService = {
      getUserProfile: vi.fn(),
      listNotes: vi.fn(),
      getNote: vi.fn(),
      createNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      bulkSyncNotes: vi.fn(),
    };

    vi.doMock('../src/services/firestore.js', () => mockFirestoreService);

    // Import fresh modules
    const { authMiddleware } = await import('../src/middleware/auth.js');
    const notesRouter = (await import('../src/routes/notes.js')).default;

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/notes', authMiddleware, notesRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/notes - List Notes', () => {
    it('should return only the authenticated user\'s notes', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.listNotes.mockResolvedValue(mockNotes);

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notes');
      expect(response.body.notes).toHaveLength(3);
      expect(mockFirestoreService.listNotes).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array when user has no notes', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.listNotes.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.notes).toEqual([]);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/notes');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/notes - Create Note', () => {
    it('should create note successfully when under limit', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 3 });
      mockFirestoreService.createNote.mockResolvedValue({
        id: 'new-note-id',
        name: 'New Note',
        content: 'New content',
        order: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Note', content: 'New content' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'new-note-id');
      expect(response.body).toHaveProperty('name', 'New Note');
    });

    it('should fail with 403 when free tier user reaches 5-note limit', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 5 });

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Another Note', content: 'Content' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/limit|upgrade|free/i);
    });

    it('should succeed for pro tier user at any note count', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'pro', noteCount: 100 });
      mockFirestoreService.createNote.mockResolvedValue({
        id: 'pro-note-id',
        name: 'Pro Note',
        content: 'Pro content',
        order: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Pro Note', content: 'Pro content' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'pro-note-id');
    });

    it('should return 400 for missing required fields', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for name exceeding max length', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'a'.repeat(256), content: 'Content' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/name|length/i);
    });

    it('should return 400 for content exceeding max length', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Note', content: 'a'.repeat(100001) });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/content|length/i);
    });
  });

  describe('GET /api/notes/:id - Get Single Note', () => {
    it('should return note for owner', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .get('/api/notes/note-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'note-1');
      expect(response.body).toHaveProperty('name', 'Test Note');
      expect(mockFirestoreService.getNote).toHaveBeenCalledWith('user-123', 'note-1');
    });

    it('should return 404 for non-existent note', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notes/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should not allow accessing other user\'s notes (403)', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      // Simulate note not found for this user (owned by different user)
      mockFirestoreService.getNote.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notes/other-users-note')
        .set('Authorization', 'Bearer valid-token');

      // Returns 404 because user's subcollection doesn't have this note
      // This is the secure pattern - don't reveal note existence to non-owners
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id - Update Note', () => {
    it('should update note for owner', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(mockNote);
      mockFirestoreService.updateNote.mockResolvedValue({
        ...mockNote,
        name: 'Updated Note',
        content: 'Updated content',
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .put('/api/notes/note-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Note', content: 'Updated content' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Updated Note');
      expect(mockFirestoreService.updateNote).toHaveBeenCalledWith(
        'user-123',
        'note-1',
        expect.objectContaining({ name: 'Updated Note', content: 'Updated content' })
      );
    });

    it('should return 404 for non-existent note', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/notes/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated', content: 'Content' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid input', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/notes/note-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'a'.repeat(256) });

      expect(response.status).toBe(400);
    });

    it('should allow partial updates', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(mockNote);
      mockFirestoreService.updateNote.mockResolvedValue({
        ...mockNote,
        name: 'Only Name Updated',
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .put('/api/notes/note-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Only Name Updated' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Only Name Updated');
    });
  });

  describe('DELETE /api/notes/:id - Delete Note', () => {
    it('should delete note for owner', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(mockNote);
      mockFirestoreService.deleteNote.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/notes/note-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockFirestoreService.deleteNote).toHaveBeenCalledWith('user-123', 'note-1');
    });

    it('should return 404 for non-existent note', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/notes/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should not allow deleting other user\'s notes', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      // Note doesn't exist in this user's subcollection
      mockFirestoreService.getNote.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/notes/other-users-note')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/notes/sync - Bulk Sync', () => {
    it('should sync notes successfully', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 2 });
      mockFirestoreService.bulkSyncNotes.mockResolvedValue({
        created: [{ id: 'new-1', name: 'New 1' }],
        updated: [{ id: 'note-1', name: 'Updated' }],
        deleted: ['note-2'],
      });

      const response = await request(app)
        .post('/api/notes/sync')
        .set('Authorization', 'Bearer valid-token')
        .send({
          notes: [
            { id: 'new-1', name: 'New 1', content: 'Content', order: 0 },
            { id: 'note-1', name: 'Updated', content: 'Updated content', order: 1 },
          ],
          deletedIds: ['note-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('created');
      expect(response.body).toHaveProperty('updated');
      expect(response.body).toHaveProperty('deleted');
    });

    it('should fail if sync would exceed free tier limit', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 4 });
      const limitError = new Error('Free tier note limit reached');
      (limitError as any).code = 'LIMIT_EXCEEDED';
      mockFirestoreService.bulkSyncNotes.mockRejectedValue(limitError);

      const response = await request(app)
        .post('/api/notes/sync')
        .set('Authorization', 'Bearer valid-token')
        .send({
          notes: [
            { name: 'Note 1', content: 'Content', order: 0 },
            { name: 'Note 2', content: 'Content', order: 1 },
          ],
          deletedIds: [],
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid sync payload', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes/sync')
        .set('Authorization', 'Bearer valid-token')
        .send({ invalid: 'payload' });

      expect(response.status).toBe(400);
    });
  });

  describe('Security - Cross-User Access Prevention', () => {
    it('should not return notes from other users in list', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.listNotes.mockResolvedValue(mockNotes);

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', 'Bearer valid-token');

      // Verify listNotes was called with correct user ID
      expect(mockFirestoreService.listNotes).toHaveBeenCalledWith('user-123');
      expect(mockFirestoreService.listNotes).not.toHaveBeenCalledWith('other-user-456');
    });

    it('should enforce user isolation on all operations', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getNote.mockResolvedValue(null);

      // Try to access note that belongs to another user
      const response = await request(app)
        .get('/api/notes/other-users-note-id')
        .set('Authorization', 'Bearer valid-token');

      // Should get 404, not the actual note
      expect(response.status).toBe(404);
      // Verify it queried with the authenticated user's ID
      expect(mockFirestoreService.getNote).toHaveBeenCalledWith('user-123', 'other-users-note-id');
    });
  });

  describe('Input Validation', () => {
    it('should sanitize HTML in note name', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 0 });
      mockFirestoreService.createNote.mockImplementation(async (userId, data) => ({
        id: 'new-note',
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: '<script>alert("xss")</script>Test', content: 'Content' });

      expect(response.status).toBe(201);
      // Name should be sanitized
      expect(response.body.name).not.toContain('<script>');
    });

    it('should reject invalid order type', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Note', content: 'Content', order: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should validate note ID format in URL', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      // Excessively long ID should be rejected
      const response = await request(app)
        .get(`/api/notes/${'a'.repeat(256)}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('Content Length Limits', () => {
    it('should enforce maximum content length', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Note',
          content: 'a'.repeat(100001), // Just over 100KB
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/content|length|size/i);
    });

    it('should accept content at maximum length', async () => {
      mockVerifyIdToken.mockResolvedValue(mockUser);
      mockFirestoreService.getUserProfile.mockResolvedValue({ tier: 'free', noteCount: 0 });
      mockFirestoreService.createNote.mockResolvedValue({
        id: 'new-note',
        name: 'Note',
        content: 'a'.repeat(100000),
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Note',
          content: 'a'.repeat(100000), // Exactly 100KB
        });

      expect(response.status).toBe(201);
    });
  });
});
