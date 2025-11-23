import base64
import io

from flask import Flask, request, jsonify
from PIL import Image
import numpy as np
import tensorflow as tf

# ===== Load model once at startup =====
MODEL_RESNET_PATH = "models/resnet50_skin_cancer.keras"
MODEL_VIT_PATH    = "models/vit_skin_cancer.keras"

IMG_SIZE = (224, 224)

print(f"Loading ResNet model from {MODEL_RESNET_PATH} ...")
resnet_model = tf.keras.models.load_model(MODEL_RESNET_PATH)
print("ResNet loaded.")

print(f"Loading ViT model from {MODEL_VIT_PATH} ...")
vit_model = tf.keras.models.load_model(MODEL_VIT_PATH)
print("ViT loaded.")

app = Flask(__name__)

def preprocess_base64_image(image_base64: str) -> np.ndarray:
    """
    image_base64: 'data:image/jpeg;base64,...' or just the base64 part.
    Returns a numpy array of shape (1, 224, 224, 3) scaled to [0,1].
    """
    # Strip data URL prefix if present
    if image_base64.startswith("data:image"):
        header, image_base64 = image_base64.split(",", 1)

    image_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)

    arr = np.array(img).astype("float32") / 255.0
    arr = np.expand_dims(arr, axis=0)  # (1, H, W, 3)
    return arr

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        if not data or "image_base64" not in data:
            return jsonify({"error": "Missing image_base64 field"}), 400

        img_array = preprocess_base64_image(data["image_base64"])

        # Method 1: ResNet
        prob_mal_resnet = float(resnet_model.predict(img_array)[0][0])
        prob_ben_resnet = 1.0 - prob_mal_resnet

        # Method 4: ViT
        prob_mal_vit = float(vit_model.predict(img_array)[0][0])
        prob_ben_vit = 1.0 - prob_mal_vit

        # Ensemble
        risk_resnet = prob_mal_resnet
        risk_vit = prob_mal_vit
        ensemble_risk = (risk_resnet + risk_vit) / 2.0
        ensemble_conf = max(ensemble_risk, 1.0 - ensemble_risk)

        if ensemble_risk >= 0.6:
            final_label = "malignant"
            final_summary = (
                "Both AI models see features consistent with a lesion that may "
                "require clinical review."
            )
        elif ensemble_risk <= 0.3:
            final_label = "benign"
            final_summary = (
                "On balance, the AI models see mostly benign-like features. "
                "However, this is not a diagnosis."
            )
        else:
            final_label = "uncertain"
            final_summary = (
                "The models are uncertain. The lesion does not clearly match benign "
                "or malignant patterns. A professional evaluation is recommended."
            )

        diff = abs(risk_resnet - risk_vit)
        if diff < 0.1:
            agreement = "Both models broadly agree about the risk level."
        elif risk_resnet > risk_vit:
            agreement = (
                "The ResNet50 model estimates a higher malignancy risk than the "
                "Vision Transformer."
            )
        else:
            agreement = (
                "The Vision Transformer model estimates a higher malignancy risk "
                "than the ResNet50 model."
            )

        explanation = (
            "This estimate combines a ResNet50 transfer-learning model (Method 1) "
            "with a Vision Transformer-style model (Method 4). "
            "Using two different architectures can improve robustness but can still "
            "be wrong. This tool is for research and education only and must not "
            "replace a dermatologist's evaluation. "
            + agreement
        )

        return jsonify({
            "ensemble": {
                "label": final_label,
                "risk_score": ensemble_risk,
                "confidence": ensemble_conf,
                "summary": final_summary,
                "explanation": explanation
            },
            "resnet": {
                "risk_score": risk_resnet,
                "confidence": max(prob_mal_resnet, prob_ben_resnet)
            },
            "vit": {
                "risk_score": risk_vit,
                "confidence": max(prob_mal_vit, prob_ben_vit)
            }
        })
    except Exception as e:
        print("Error during prediction:", e)
        return jsonify({"error": "Internal prediction error"}), 500


if __name__ == "__main__":
    # Run on localhost:8000
    app.run(host="127.0.0.1", port=8000, debug=True)
