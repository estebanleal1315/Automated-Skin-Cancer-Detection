const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '15mb' }));  // for base64 images
app.use(express.static(path.join(__dirname, 'public')));

/* ============================
   AI Analysis Endpoint
=============================== */
app.post('/api/analyze', async (req, res) => {
  try {
    const { image_base64 } = req.body || {};
    if (!image_base64) {
      return res.status(400).json({ error: 'Missing image_base64' });
    }

    // Forward the request to the Python inference server
    const pyResp = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64 }),
    });

    const data = await pyResp.json();

    if (!pyResp.ok) {
      console.error('Python error:', data);
      return res.status(500).json({ error: 'Model server error' });
    }

    // Just pass through what Python sent
    return res.json(data);
  } catch (err) {
    console.error('Node /api/analyze error:', err);
    res.status(500).json({ error: 'Internal error during analysis' });
  }
});

/* ============================
   Start Server
=============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SkinCheck AI server running on http://localhost:${PORT}`);
});
