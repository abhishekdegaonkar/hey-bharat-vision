let model;
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");

// Speech settings
const tts = window.speechSynthesis;
let lastSpoken = "";
let cooldown = false;

// Speak function
function speak(text) {
  if (cooldown || text === lastSpoken) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  tts.speak(utter);

  lastSpoken = text;
  cooldown = true;
  setTimeout(() => (cooldown = false), 2500);
}

// Smart activity detector (simple rule-based)
function guessActivity(obj) {
  if (obj.class === "person") {
    if (obj.bbox[3] > obj.bbox[2] * 1.4) return "is standing";
    if (obj.bbox[2] > obj.bbox[3]) return "is lying down";
    return "is sitting";
  }
  return "";
}

// Start back camera
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
    alert("Camera access blocked!");
    console.error(err);
  }
}

// Main detection loop
async function detectLoop() {
  if (!model) return;

  const preds = await model.detect(video);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let names = [];
  let humans = 0;

  preds.forEach(p => {
    const [x, y, w, h] = p.bbox;

    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    const label = p.class;
    const activity = guessActivity(p);

    ctx.fillStyle = "#00d4ff";
    ctx.font = "18px Arial";
    ctx.fillText(label, x, y - 5);

    names.push(label + (activity ? " (" + activity + ")" : ""));

    if (label === "person") humans++;
  });

  if (names.length > 0) {
    let text = "";

    if (humans > 0) text += `${humans} people detected. `;
    text += "I see " + names.join(", ");

    speak(text);
    statusText.innerText = text;
  } else {
    statusText.innerText = "No objects detected";
  }

  requestAnimationFrame(detectLoop);
}

// Init everything
async function init() {
  statusText.innerText = "Loading model...";
  model = await cocoSsd.load();
  statusText.innerText = "Model Loaded. Starting camera...";
  await startCamera();

  setTimeout(() => {
    statusText.innerText = "Detecting...";
    detectLoop();
  }, 1200);
}

init();
