/**
 * Notes API Routes
 *
 * CRUD operations for user notes with:
 * - Authentication required for all routes
 * - User isolation (can only access own notes)
 * - Free tier limit enforcement (5 notes)
 * - Input validation and sanitization
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  validateNoteId,
  validateCreateNote,
  validateUpdateNote,
  validateSyncRequest,
} from '../middleware/validation.js';
import {
  getUserProfile,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  bulkSyncNotes,
} from '../services/firestore.js';

const router = Router();

/**
 * GET /api/notes
 * List all notes for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const notes = await listNotes(userId);

    res.json({ notes });
  } catch (error) {
    console.error('Error listing notes:', error);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

/**
 * POST /api/notes
 * Create a new note
 * Enforces 5-note limit for free tier users
 */
router.post(
  '/',
  validateCreateNote,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { name, content, order } = req.body;

      // Check user tier and limit
      const profile = await getUserProfile(userId);

      if (profile.tier === 'free' && profile.noteCount >= 5) {
        res.status(403).json({
          error: 'Free tier note limit reached (5 notes). Upgrade to Pro for unlimited notes.',
        });
        return;
      }

      const note = await createNote(userId, { name, content, order });

      res.status(201).json(note);
    } catch (error: any) {
      if (error.code === 'LIMIT_EXCEEDED') {
        res.status(403).json({
          error: 'Free tier note limit reached. Upgrade to Pro for unlimited notes.',
        });
        return;
      }

      console.error('Error creating note:', error);
      res.status(500).json({ error: 'Failed to create note' });
    }
  }
);

/**
 * POST /api/notes/sync
 * Bulk sync endpoint for offline-first syncing
 */
router.post(
  '/sync',
  validateSyncRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { notes, deletedIds } = req.body;

      const result = await bulkSyncNotes(userId, notes, deletedIds);

      res.json(result);
    } catch (error: any) {
      if (error.code === 'LIMIT_EXCEEDED') {
        res.status(403).json({
          error: 'Free tier note limit reached. Upgrade to Pro for unlimited notes.',
        });
        return;
      }

      console.error('Error syncing notes:', error);
      res.status(500).json({ error: 'Failed to sync notes' });
    }
  }
);

/**
 * GET /api/notes/:id
 * Get a single note by ID
 */
router.get(
  '/:id',
  validateNoteId,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.uid;
      const id = req.params.id as string;

      const note = await getNote(userId, id);

      if (!note) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      res.json(note);
    } catch (error) {
      console.error('Error getting note:', error);
      res.status(500).json({ error: 'Failed to get note' });
    }
  }
);

/**
 * PUT /api/notes/:id
 * Update a note
 */
router.put(
  '/:id',
  validateNoteId,
  validateUpdateNote,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.uid;
      const id = req.params.id as string;
      const { name, content, order } = req.body;

      // First check if note exists
      const existingNote = await getNote(userId, id);
      if (!existingNote) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      const note = await updateNote(userId, id, { name, content, order });

      res.json(note);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      console.error('Error updating note:', error);
      res.status(500).json({ error: 'Failed to update note' });
    }
  }
);

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete(
  '/:id',
  validateNoteId,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.uid;
      const id = req.params.id as string;

      // First check if note exists
      const existingNote = await getNote(userId, id);
      if (!existingNote) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      await deleteNote(userId, id);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting note:', error);
      res.status(500).json({ error: 'Failed to delete note' });
    }
  }
);

export default router;
