/**
 * DEPRECATED — demo auth routes have been removed. This router exports an
 * empty Express router so any stale `import authDemoRoutes from ...` keeps
 * working without mounting any endpoints.
 */
import express from 'express';
const router = express.Router();
export default router;
