import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/**
 * Audit-log middleware.
 * Records every mutating request (POST/PUT/PATCH/DELETE) reaching /api/*.
 * Non-mutating GETs are skipped to keep the log focused on state changes.
 *
 * This runs AFTER authenticateJWT, so req.user may be populated.
 * It wraps res.end so we can capture the final status code and latency.
 */
export const auditLog = (req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const startedAt = Date.now();
  const { method, originalUrl, ip, headers } = req;

  const origEnd = res.end;
  res.end = function (...args) {
    try {
      const statusCode = res.statusCode;
      const action = deriveAction(req, statusCode);
      AuditLog.record({
        userId: req.user?._id,
        orgId: req.user?.orgId || req.org?._id,
        actor: {
          email: req.user?.email,
          role: req.user?.role,
          apiKeyId: req.apiKey?._id,
        },
        action,
        resource: deriveResource(req),
        method,
        path: originalUrl || req.path,
        ip,
        userAgent: headers['user-agent'],
        requestId: req.id,
        statusCode,
        success: statusCode < 400,
        durationMs: Date.now() - startedAt,
      }).catch(() => {});
    } catch (e) {
      logger.warn('auditLog middleware error:', e?.message);
    }
    return origEnd.apply(res, args);
  };
  next();
};

function deriveAction(req, statusCode) {
  // /api/<resource>/... -> resource
  const parts = (req.originalUrl || req.path).split('?')[0].split('/').filter(Boolean);
  const resource = parts[1] || 'unknown';
  const verbByMethod = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  let verb = verbByMethod[req.method] || req.method.toLowerCase();
  // Special cases
  if (resource === 'auth') {
    const sub = parts[2] || 'action';
    verb = statusCode >= 400 ? `${sub}_failed` : sub;
    return `auth.${verb}`;
  }
  if (resource === 'api-keys' && parts[3] === 'revoke') return 'apiKey.revoke';
  if (resource === 'api-keys' && parts[3] === 'rotate') return 'apiKey.rotate';
  return `${resource.replace(/s$/, '')}.${verb}`;
}

function deriveResource(req) {
  const parts = (req.originalUrl || req.path).split('?')[0].split('/').filter(Boolean);
  return {
    type: parts[1] || 'unknown',
    id: parts[2] && /^[a-f0-9]{24}$|^[a-zA-Z0-9_-]{4,}$/.test(parts[2]) ? parts[2] : undefined,
  };
}

export default auditLog;
