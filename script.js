const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let objectModel;

// Start Camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } } // Back cam on mobile
        });

        video.srcObject = stream;
    } catch (err) {
        alert("Camera access blocked or not available!");
    }
}

// Load AI Models
async function loadModels() {
    objectModel = await cocoSsd.load();

    await faceapi.nets.tinyFaceDetector.loadFromUri(
        "https://justadomain2.github.io/models/"
    );
    await faceapi.nets.faceExpressionNet.loadFromUri(
        "https://justadomain2.github.io/models/"
    );
}

function isLivingBeing(name) {
    const living = ["person", "cat", "dog", "bird", "horse", "sheep", "cow"];
    return living.includes(name.toLowerCase());
}

// Main Detection Loop
async function detect() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Object detection
    const predictions = await objectModel.detect(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0);

    predictions.forEach(pred => {
        const [x, y, w, h] = pred.bbox;

        // living being → green, object → blue
        ctx.strokeStyle = isLivingBeing(pred.class) ? "lime" : "cyan";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = "yellow";
        ctx.font = "18px Arial";
        ctx.fillText(pred.class, x, y - 5);
    });

    // Face + emotion detection
    const face = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

    if (face) {
        const box = face.detection.box;
        ctx.strokeStyle = "lime";
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const emotion = Object.entries(face.expressions)
            .sort((a, b) => b[1] - a[1])[0][0];

        ctx.fillStyle = "red";
        ctx.fillText("Emotion: " + emotion, box.x, box.y - 10);
    }

    requestAnimationFrame(detect);
}

// Initialize
async function init() {
    await startCamera();
    await loadModels();
    detect();
}

init();
