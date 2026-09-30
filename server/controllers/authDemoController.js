/**
 * DEPRECATED — demo login/register endpoints have been removed. Every
 * method below responds 410 Gone so anyone still hitting them gets a
 * clear signal to switch to /api/auth. See SETUP_REAL.md.
 */
const gone = (res) =>
  res.status(410).json({
    success: false,
    message: 'Demo auth removed. Use /api/auth/login and /api/auth/register with real credentials.',
  });

export const demoLogin = (_req, res) => gone(res);
export const demoRegister = (_req, res) => gone(res);
export const demoMe = (_req, res) => gone(res);
export const demoRefresh = (_req, res) => gone(res);
export const demoLogout = (_req, res) => gone(res);

export default { demoLogin, demoRegister, demoMe, demoRefresh, demoLogout };
