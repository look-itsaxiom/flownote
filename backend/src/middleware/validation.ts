/**
 * Input Validation Middleware
 *
 * Validates and sanitizes input for note operations.
 * Security: Prevents XSS, enforces size limits, validates types.
 */

import { Request, Response, NextFunction } from 'express';
import { NOTE_LIMITS } from '../types/index.js';

/**
 * Sanitize string input by removing HTML tags
 * Basic XSS prevention - removes all HTML tags
 */
function sanitizeString(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Validate note ID format
 */
function isValidNoteId(id: string): boolean {
  // Must be a string, not too long, alphanumeric with dashes/underscores
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= NOTE_LIMITS.MAX_ID_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

/**
 * Middleware to validate note ID parameter
 */
export function validateNoteId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id = req.params.id as string;

  if (!id || !isValidNoteId(id)) {
    res.status(400).json({
      error: 'Invalid note ID format',
    });
    return;
  }

  next();
}

/**
 * Middleware to validate note creation input
 */
export function validateCreateNote(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { name, content, order } = req.body;

  // Name is required
  if (!name || typeof name !== 'string') {
    res.status(400).json({
      error: 'Note name is required and must be a string',
    });
    return;
  }

  // Validate name length
  if (name.length > NOTE_LIMITS.MAX_NAME_LENGTH) {
    res.status(400).json({
      error: `Note name must be ${NOTE_LIMITS.MAX_NAME_LENGTH} characters or less`,
    });
    return;
  }

  // Validate content if provided
  if (content !== undefined) {
    if (typeof content !== 'string') {
      res.status(400).json({
        error: 'Note content must be a string',
      });
      return;
    }

    if (content.length > NOTE_LIMITS.MAX_CONTENT_LENGTH) {
      res.status(400).json({
        error: `Note content must be ${NOTE_LIMITS.MAX_CONTENT_LENGTH} characters or less`,
      });
      return;
    }
  }

  // Validate order if provided
  if (order !== undefined) {
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      res.status(400).json({
        error: 'Note order must be a valid number',
      });
      return;
    }
  }

  // Sanitize input
  req.body.name = sanitizeString(name.trim());
  if (content) {
    req.body.content = content; // Don't sanitize markdown content
  }

  next();
}

/**
 * Middleware to validate note update input
 */
export function validateUpdateNote(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { name, content, order } = req.body;

  // At least one field should be provided
  if (name === undefined && content === undefined && order === undefined) {
    res.status(400).json({
      error: 'At least one field (name, content, or order) must be provided',
    });
    return;
  }

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== 'string') {
      res.status(400).json({
        error: 'Note name must be a string',
      });
      return;
    }

    if (name.length > NOTE_LIMITS.MAX_NAME_LENGTH) {
      res.status(400).json({
        error: `Note name must be ${NOTE_LIMITS.MAX_NAME_LENGTH} characters or less`,
      });
      return;
    }

    req.body.name = sanitizeString(name.trim());
  }

  // Validate content if provided
  if (content !== undefined) {
    if (typeof content !== 'string') {
      res.status(400).json({
        error: 'Note content must be a string',
      });
      return;
    }

    if (content.length > NOTE_LIMITS.MAX_CONTENT_LENGTH) {
      res.status(400).json({
        error: `Note content must be ${NOTE_LIMITS.MAX_CONTENT_LENGTH} characters or less`,
      });
      return;
    }
  }

  // Validate order if provided
  if (order !== undefined) {
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      res.status(400).json({
        error: 'Note order must be a valid number',
      });
      return;
    }
  }

  next();
}

/**
 * Middleware to validate bulk sync input
 */
export function validateSyncRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { notes, deletedIds } = req.body;

  // Notes must be an array
  if (!Array.isArray(notes)) {
    res.status(400).json({
      error: 'Notes must be an array',
    });
    return;
  }

  // DeletedIds must be an array if provided
  if (deletedIds !== undefined && !Array.isArray(deletedIds)) {
    res.status(400).json({
      error: 'deletedIds must be an array',
    });
    return;
  }

  // Validate each note in the array
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    // Validate ID if provided
    if (note.id !== undefined) {
      if (!isValidNoteId(note.id)) {
        res.status(400).json({
          error: `Invalid note ID format at index ${i}`,
        });
        return;
      }
    }

    // Name is required
    if (!note.name || typeof note.name !== 'string') {
      res.status(400).json({
        error: `Note name is required at index ${i}`,
      });
      return;
    }

    if (note.name.length > NOTE_LIMITS.MAX_NAME_LENGTH) {
      res.status(400).json({
        error: `Note name too long at index ${i}`,
      });
      return;
    }

    // Content is required for sync
    if (typeof note.content !== 'string') {
      res.status(400).json({
        error: `Note content must be a string at index ${i}`,
      });
      return;
    }

    if (note.content.length > NOTE_LIMITS.MAX_CONTENT_LENGTH) {
      res.status(400).json({
        error: `Note content too long at index ${i}`,
      });
      return;
    }

    // Order is required for sync
    if (typeof note.order !== 'number' || !Number.isFinite(note.order)) {
      res.status(400).json({
        error: `Note order must be a number at index ${i}`,
      });
      return;
    }

    // Sanitize name
    notes[i].name = sanitizeString(note.name.trim());
  }

  // Validate deletedIds
  if (deletedIds) {
    for (const id of deletedIds) {
      if (!isValidNoteId(id)) {
        res.status(400).json({
          error: 'Invalid note ID in deletedIds',
        });
        return;
      }
    }
  }

  // Set defaults
  req.body.deletedIds = deletedIds || [];

  next();
}
