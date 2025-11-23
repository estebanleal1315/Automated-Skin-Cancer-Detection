import base64
import io

from flask import Flask, request, jsonify
from PIL import Image
import numpy as np
import tensorflow as tf

# ===== Load model once at startup =====
MODEL_PATH = "models/resnet50_skin_cancer.keras"  # adjust if needed
IMG_SIZE = (224, 224)

print(f"Loading model from {MODEL_PATH} ...")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded.")

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

        # Model outputs probability of malignant (class 1)
        prob_mal = float(model.predict(img_array)[0][0])
        prob_ben = 1.0 - prob_mal

        # Risk_score = malignant probability
        risk_score = prob_mal
        confidence = max(prob_mal, prob_ben)  # "how sure" the model is

        if risk_score >= 0.6:
            label = "malignant"
            summary = (
                "The model sees a pattern that may be consistent with a malignant lesion "
                "and recommends further clinical review."
            )
        elif risk_score <= 0.3:
            label = "benign"
            summary = (
                "The model sees mostly benign-like features in this lesion. "
                "However, this is not a diagnosis."
            )
        else:
            label = "uncertain"
            summary = (
                "The model is uncertain and the lesion does not clearly fall into benign or malignant "
                "patterns. A professional clinical evaluation is recommended."
            )

        explanation = (
            "This estimate is based on a ResNet50 model fine-tuned on HAM10000 dermoscopic images. "
            "It analyzes color variation, asymmetry, border irregularity and texture patterns to "
            "estimate malignancy risk. This tool is for educational and research use only and "
            "must not replace professional diagnosis."
        )

        return jsonify({
            "label": label,
            "risk_score": risk_score,
            "confidence": confidence,
            "summary": summary,
            "explanation": explanation
        })
    except Exception as e:
        print("Error during prediction:", e)
        return jsonify({"error": "Internal prediction error"}), 500


if __name__ == "__main__":
    # Run on localhost:8000
    app.run(host="127.0.0.1", port=8000, debug=True)
