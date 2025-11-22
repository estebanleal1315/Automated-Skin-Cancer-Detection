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
    const { image_base64 } = req.body;

    if (!image_base64) {
      return res.status(400).json({ error: "Missing image_base64" });
    }

    // TODO: Replace this with your real ML model pipeline
    const fakeRisk = Math.random();
    const label = fakeRisk > 0.5 ? "malignant" : "benign";

    return res.json({
      label,
      risk_score: fakeRisk,
      confidence: 0.85,
      summary: label === "malignant"
        ? "The model found irregular features that may require clinical review."
        : "The lesion shows mostly regular benign-like features.",
      explanation: "This is placeholder logic. Once your CNN is trained, replace this with real model outputs."
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   Start Server
=============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SkinCheck AI server running on http://localhost:${PORT}`);
});
