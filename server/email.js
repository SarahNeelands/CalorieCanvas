const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildMessage(kind, publicAppOrigin, token) {
  const isReset = kind === 'password-reset';
  const route = isReset ? '/reset' : '/verify-email';
  const action = isReset ? 'reset your Calorie Canvas password' : 'verify your Calorie Canvas email';
  const url = `${publicAppOrigin}${route}?token=${encodeURIComponent(token)}`;
  return {
    subject: isReset ? 'Reset your Calorie Canvas password' : 'Verify your Calorie Canvas email',
    text: `Use this link to ${action}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to ${action}.</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}

function createEmailDelivery(config, { fetchImpl = global.fetch, logger = console, waitImpl = wait } = {}) {
  if (config.provider === 'disabled') {
    return {
      sendPasswordReset: async () => false,
      sendEmailVerification: async () => false,
    };
  }

  async function send(kind, { email, token }) {
    if (config.allowedRecipients.length > 0
      && !config.allowedRecipients.includes(String(email).toLowerCase())) {
      logger.warn('Authentication email suppressed by the configured recipient allowlist.');
      return false;
    }

    const message = buildMessage(kind, config.publicAppOrigin, token);
    let failureReason = 'unknown error';
    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: config.from, to: [email], ...message }),
          signal: AbortSignal.timeout(config.requestTimeoutMs),
        });
        if (response.ok) return true;
        failureReason = `HTTP ${response.status}`;
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        failureReason = error?.name === 'TimeoutError' ? 'request timeout' : 'network error';
      }

      if (attempt < config.maxAttempts) {
        await waitImpl(config.retryBaseMs * (2 ** (attempt - 1)));
      }
    }

    logger.error(
      `Authentication ${kind} email delivery failed after configured retries (${failureReason}).`
    );
    return false;
  }

  return {
    sendPasswordReset: (payload) => send('password-reset', payload),
    sendEmailVerification: (payload) => send('email-verification', payload),
  };
}

module.exports = { createEmailDelivery };
