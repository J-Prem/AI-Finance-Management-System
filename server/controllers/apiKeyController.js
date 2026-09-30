import ApiKey from '../models/ApiKey.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateApiKey } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * Normalise the incoming permissions/scopes array from the client.
 * Client UI sends `scopes: ['read', 'write', 'admin']` — we accept those
 * generic values and also any granular scopes allowed by the schema.
 */
function normalisePerms(body) {
  const raw = body?.permissions ?? body?.scopes ?? [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '').split(/[,\s]+/).filter(Boolean);
  const cleaned = list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  return cleaned.length ? cleaned : ['read'];
}

function shape(apiKey) {
  const o = apiKey.toObject ? apiKey.toObject() : { ...apiKey };
  o.scopes = o.permissions;
  o.id = o._id;
  return o;
}

export const generateKey = asyncHandler(async (req, res) => {
  const { name, description = '', rateLimit, restrictions, expiresInDays } = req.body;
  const permissions = normalisePerms(req.body);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'API key name is required' });
  }

  const key = generateApiKey();
  const doc = {
    userId: req.user._id,
    name: String(name).trim(),
    description,
    key,
    permissions,
  };
  if (rateLimit && typeof rateLimit === 'object') doc.rateLimit = rateLimit;
  if (restrictions && typeof restrictions === 'object') doc.restrictions = restrictions;
  if (expiresInDays && Number(expiresInDays) > 0) {
    doc.restrictions = doc.restrictions || {};
    doc.restrictions.expiresAt = new Date(Date.now() + Number(expiresInDays) * 86400 * 1000);
  }

  const apiKey = await ApiKey.create(doc);

  res.status(201).json({
    success: true,
    message: 'API key generated successfully',
    data: {
      plaintextKey: key,
      key,
      apiKey: {
        id: apiKey._id,
        _id: apiKey._id,
        name: apiKey.name,
        key,
        keyPreview: apiKey.keyPreview,
        permissions: apiKey.permissions,
        scopes: apiKey.permissions,
        isActive: apiKey.isActive,
        rateLimit: apiKey.rateLimit,
        restrictions: apiKey.restrictions,
        createdAt: apiKey.createdAt,
      },
    },
  });
});

export const listKeys = asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ userId: req.user._id })
    .select('-key')
    .sort({ createdAt: -1 });
  const shaped = keys.map((k) => shape(k));
  res.json({
    success: true,
    data: { keys: shaped, apiKeys: shaped, total: shaped.length },
  });
});

export const getKey = asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).select('-key');
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  res.json({ success: true, data: { apiKey: shape(apiKey) } });
});

export const updateKey = asyncHandler(async (req, res) => {
  const { name, rateLimit, restrictions, isActive } = req.body;
  const incomingPerms =
    req.body?.permissions !== undefined || req.body?.scopes !== undefined
      ? normalisePerms(req.body)
      : null;

  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }

  if (name) apiKey.name = name;
  if (incomingPerms) apiKey.permissions = incomingPerms;
  if (rateLimit) apiKey.rateLimit = { ...apiKey.rateLimit, ...rateLimit };
  if (restrictions) apiKey.restrictions = { ...apiKey.restrictions, ...restrictions };
  if (typeof isActive === 'boolean') apiKey.isActive = isActive;

  await apiKey.save();

  res.json({
    success: true,
    message: 'API key updated successfully',
    data: { apiKey: shape(apiKey) },
  });
});

export const revokeKey = asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  apiKey.revoke();
  await apiKey.save();
  res.json({ success: true, message: 'API key revoked successfully' });
});

export const rotateKey = asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  const newKey = generateApiKey();
  apiKey.rotateKey(newKey, 'Manual rotation');
  await apiKey.save();
  res.json({
    success: true,
    message: 'API key rotated successfully',
    data: {
      plaintextKey: newKey,
      key: newKey,
      apiKey: {
        id: apiKey._id,
        _id: apiKey._id,
        name: apiKey.name,
        key: newKey,
        keyPreview: apiKey.keyPreview,
        permissions: apiKey.permissions,
        scopes: apiKey.permissions,
      },
    },
  });
});

export const deleteKey = asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  await ApiKey.deleteOne({ _id: apiKey._id });
  res.json({ success: true, message: 'API key deleted successfully' });
});

export const addPermission = asyncHandler(async (req, res) => {
  const { permission } = req.body;
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  apiKey.addPermission(permission);
  await apiKey.save();
  res.json({
    success: true,
    message: 'Permission added successfully',
    data: { apiKey: shape(apiKey) },
  });
});

export const removePermission = asyncHandler(async (req, res) => {
  const { permission } = req.body;
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  apiKey.removePermission(permission);
  await apiKey.save();
  res.json({
    success: true,
    message: 'Permission removed successfully',
    data: { apiKey: shape(apiKey) },
  });
});

export const getKeyUsage = asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
  if (!apiKey) {
    return res.status(404).json({ success: false, message: 'API key not found' });
  }
  res.json({
    success: true,
    data: {
      usage: {
        totalRequests: apiKey.usageStats.totalRequests,
        requestsThisMonth: apiKey.usageStats.requestsThisMonth,
        lastUsed: apiKey.lastUsed,
        lastIpAddress: apiKey.lastIpAddress,
      },
    },
  });
});
