function createCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  };
}

function setAuthenticationCookies(res, config, session) {
  if (!session) return;
  const options = { ...createCookieOptions(config), expires: session.expiresAt };
  res.cookie(config.cookieName, session.rawSessionId, options);
  res.cookie(config.csrfCookieName, session.rawCsrfToken, options);
}

function renewAuthenticationCookies(res, config, { rawSessionId, rawCsrfToken, expiresAt }) {
  const options = { ...createCookieOptions(config), expires: expiresAt };
  res.cookie(config.cookieName, rawSessionId, options);
  res.cookie(config.csrfCookieName, rawCsrfToken, options);
}

function clearAuthenticationCookies(res, config) {
  const options = createCookieOptions(config);
  res.clearCookie(config.cookieName, options);
  res.clearCookie(config.csrfCookieName, options);
}

module.exports = {
  clearAuthenticationCookies,
  createCookieOptions,
  renewAuthenticationCookies,
  setAuthenticationCookies,
};
