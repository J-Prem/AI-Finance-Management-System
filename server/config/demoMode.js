/**
 * DEPRECATED — demo mode has been removed. This file is a no-op stub kept so
 * any stale dynamic import doesn't crash. Production must use real MongoDB,
 * JWT_SECRET, and LLM keys. See SETUP_REAL.md.
 */
export function isDemoMode() { return false; }

export async function connectOrDemo() {
  throw new Error('Demo mode is deprecated. Configure MONGODB_URI and use connectDB(). See SETUP_REAL.md.');
}

export default { isDemoMode, connectOrDemo };
