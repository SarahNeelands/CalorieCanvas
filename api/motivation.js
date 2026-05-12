module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const backendBaseUrl = String(process.env.MOTIVATION_BACKEND_URL || '').trim().replace(/\/$/, '');
  const backendSecret = String(process.env.MOTIVATION_BACKEND_SECRET || '').trim();

  if (!backendBaseUrl) {
    return res.status(500).json({ error: 'Missing MOTIVATION_BACKEND_URL' });
  }

  if (!backendSecret) {
    return res.status(500).json({ error: 'Missing MOTIVATION_BACKEND_SECRET' });
  }

  const body = typeof req.body === 'string'
    ? (() => {
        try {
          return JSON.parse(req.body);
        } catch {
          return null;
        }
      })()
    : req.body;

  const eventType = String(body?.eventType || '').trim();
  const userId = String(body?.userId || '').trim();
  const occurredAt = String(body?.occurredAt || '').trim();

  if (!eventType || !userId || !occurredAt) {
    return res.status(400).json({ error: 'Missing required event fields' });
  }

  try {
    const upstreamResponse = await fetch(`${backendBaseUrl}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-motivation-secret': backendSecret,
      },
      body: JSON.stringify({
        sourceApp: 'calorie-canvas',
        eventType,
        userId,
        occurredAt,
        details: body?.details && typeof body.details === 'object' ? body.details : {},
      }),
    });

    const responseText = await upstreamResponse.text();
    let parsedBody = null;
    if (responseText) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = { message: responseText };
      }
    }

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: 'Motivation backend rejected event',
        upstream: parsedBody,
      });
    }

    return res.status(200).json({
      ok: true,
      upstream: parsedBody,
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Failed to reach Motivation backend',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
