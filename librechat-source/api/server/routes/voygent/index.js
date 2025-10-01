/**
 * Voygent API Routes Index
 * Feature: 002-librechat-interface-modifications
 *
 * Exports all Voygent-specific API routes.
 */

import { Router } from 'express';
import tokenUsageRouter from './token-usage.js';
import tripProgressRouter from './trip-progress.js';
import statusRouter from './status.js';
import mcpHealthRouter from './mcp-health.js';

const router = Router();

// Mount all voygent routes
router.use(tokenUsageRouter);
router.use(tripProgressRouter);
router.use(statusRouter);
router.use(mcpHealthRouter);

export default router;
