// script.js – SkinCheck AI front-end
document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const dropZone = document.getElementById("dropZone");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const previewWrapper = document.getElementById("previewWrapper");
  const imagePreview = document.getElementById("imagePreview");

  const resultEmpty = document.getElementById("resultEmpty");
  const resultCard = document.getElementById("resultCard");
  const riskTag = document.getElementById("riskTag");
  const confidenceTag = document.getElementById("confidenceTag");
  const resultSummary = document.getElementById("resultSummary");
  const resultExplanation = document.getElementById("resultExplanation");
  const riskMeterFill = document.getElementById("riskMeterFill");
  const loadingBlock = document.getElementById("loadingBlock");

  let currentImageBase64 = null;

  /* ---------- helpers ---------- */

  function setLoading(isLoading) {
    if (isLoading) {
      loadingBlock.classList.remove("hidden");
      analyzeBtn.disabled = true;
    } else {
      loadingBlock.classList.add("hidden");
      analyzeBtn.disabled = !currentImageBase64;
    }
  }

  function showPreview(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result; // data:image/...;base64,...
      imagePreview.src = currentImageBase64;
      previewWrapper.classList.remove("hidden");
      analyzeBtn.disabled = false;
      resultCard.classList.add("hidden");
      resultEmpty.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    showPreview(file);
  }

  /* ---------- drag & drop ---------- */

  imageInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drop-zone-active");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone-active");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone-active");
    handleFiles(e.dataTransfer.files);
  });

/* ---------- analysis ---------- */

analyzeBtn.addEventListener("click", async () => {
  if (!currentImageBase64) return;
  setLoading(true);
  resultEmpty.classList.add("hidden");
  resultCard.classList.add("hidden");

  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: currentImageBase64
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || "Analysis failed");
    }

    // 🔍 DEBUG LOG
    console.log("API response:", data);

    // --- NEW FORMAT EXPECTED ---
    // {
    //   ensemble: { label, risk_score, confidence, summary, explanation },
    //   resnet: {...},
    //   vit: {...}
    // }

    // Use ensemble if it exists, else fallback to flat format
    const ens = data.ensemble || data;
    const resnet = data.resnet || null;
    const vit = data.vit || null;

    // Prevent the 50% fallback: enforce valid risk score
    if (ens.risk_score === undefined || isNaN(ens.risk_score)) {
      console.error("❌ No valid ensemble.risk_score returned:", ens);
      alert("The AI did not return a valid risk score. Check the Python server.");
      setLoading(false);
      return;
    }

    const label = (ens.label || "unknown").toLowerCase();
    const riskScore = Math.min(Math.max(ens.risk_score, 0), 1);
    const conf = Math.min(Math.max(ens.confidence ?? 0.5, 0), 1);

    // ───────── RISK TAG ─────────
    if (label === "malignant" || riskScore >= 0.6) {
      riskTag.textContent = "Needs review";
      riskTag.className = "risk-tag risk-high";
    } else if (riskScore <= 0.3) {
      riskTag.textContent = "Likely benign";
      riskTag.className = "risk-tag risk-low";
    } else {
      riskTag.textContent = "Uncertain";
      riskTag.className = "risk-tag risk-medium";
    }

    confidenceTag.textContent = `Confidence: ${(conf * 100).toFixed(1)}%`;

    // ───────── SUMMARY & EXPLANATION ─────────
    resultSummary.textContent =
      ens.summary ||
      "The ensemble of AI models estimated the malignancy risk for this lesion.";

    // Add ResNet vs ViT comparison sentence if available
    let comparisonLine = "";
    if (resnet && vit) {
      const r = (resnet.risk_score * 100).toFixed(0);
      const v = (vit.risk_score * 100).toFixed(0);
      comparisonLine = ` ResNet50 estimated ${r}% risk, while the Vision Transformer estimated ${v}% risk.`;
    }

    resultExplanation.textContent =
      (ens.explanation || "") + comparisonLine;

    // ───────── METER FILL ─────────
    riskMeterFill.style.width = `${Math.round(riskScore * 100)}%`;

    resultCard.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Analysis error:", err);
    alert("There was an error analyzing the image. Please try again.");
    resultEmpty.classList.remove("hidden");
  } finally {
    setLoading(false);
  }
});

});
