let model;
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status-text");

// Text-to-Speech Setup
const tts = window.speechSynthesis;
let lastSpoken = "";
let speakingCooldown = false;

function speak(text) {
  if (speakingCooldown || text === lastSpoken) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";

  tts.speak(utter);
  lastSpoken = text;

  speakingCooldown = true;
  setTimeout(() => (speakingCooldown = false), 2500);
}

// Start Back Camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
  } catch (err) {
    alert("Camera access denied or unsupported.");
    console.error(err);
  }
}

// Main Detection Loop
async function detectFrame() {
  if (!model) return;

  const predictions = await model.detect(video);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let detectedNames = [];

  predictions.forEach(pred => {
    const [x, y, w, h] = pred.bbox;

    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#00d4ff";
    ctx.font = "18px Arial";
    ctx.fillText(pred.class, x, y > 10 ? y - 5 : y + 20);

    detectedNames.push(pred.class);
  });

  if (detectedNames.length > 0) {
    const sentence = "I see " + detectedNames.join(", ");
    speak(sentence);
    statusText.innerText = sentence;
  } else {
    statusText.innerText = "No objects detected";
  }

  requestAnimationFrame(detectFrame);
}

// Load Model
async function init() {
  statusText.innerText = "Loading TensorFlow model...";
  model = await cocoSsd.load();
  statusText.innerText = "Model loaded. Starting camera...";
  await startCamera();

  setTimeout(() => {
    statusText.innerText = "Detecting objects...";
    detectFrame();
  }, 1500);
}

init();

