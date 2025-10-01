const express = require('express');
const axios = require('axios');

const router = express.Router();

// Proxy helper to call an upstream status/start source if configured
const SOURCE = process.env.VOYGEN_STATUS_SOURCE_URL || '';
const AUTO_START = String(process.env.VOYGEN_AUTO_START || '').toLowerCase() === 'true';
const DEFAULT_QUERY = process.env.VOYGEN_DEFAULT_TRIP_QUERY || '';

router.get('/status', async (req, res) => {
  try {
    if (!SOURCE) {
      return res.status(204).end();
    }
    const q = (req.query.q || DEFAULT_QUERY || '').toString();
    const url = new URL('/status', SOURCE);
    if (q) url.searchParams.set('q', q);
    const { data, status } = await axios.get(url.toString(), { timeout: 6000 });
    return res.status(status).json(data);
  } catch (err) {
    const status = err?.response?.status || 502;
    return res.status(status).json({ ok: false, error: 'voygen_status_upstream_error' });
  }
});

router.get('/start', async (_req, res) => {
  try {
    if (!AUTO_START) {
      return res.status(200).json({ ok: true, autoStart: false });
    }
    if (SOURCE) {
      const url = new URL('/start', SOURCE);
      const { data, status } = await axios.get(url.toString(), { timeout: 6000 });
      return res.status(status).json(data);
    }
    // Fallback minimal payload
    return res.status(200).json({
      ok: true,
      autoStart: true,
      message: 'Claude Travel Agent System Ready',
      recent: [],
    });
  } catch (err) {
    const status = err?.response?.status || 502;
    return res.status(status).json({ ok: false, error: 'voygen_start_upstream_error' });
  }
});

module.exports = router;

