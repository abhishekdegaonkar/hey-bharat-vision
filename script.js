// =============================
// AI Vision Assistant — Advanced
// Multi-language + Object Count
// =============================

let model;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");

// ---------- Language Settings ----------
let currentLang = "en-US"; // change: hi-IN, mr-IN, en-US

function setLanguage(langCode) {
  currentLang = langCode;
}

// ---------- Speech ----------
const tts = window.speechSynthesis;
let lastSentence = "";
let lastSpeakTime = 0;

function speak(text) {
  const now = Date.now();
  if (text === lastSentence && now - lastSpeakTime < 3000) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLang;
  utter.rate = 1;

  tts.cancel();
  tts.speak(utter);

  lastSentence = text;
  lastSpeakTime = now;
}

// ---------- Grammar helper ----------
function pluralize(word, count) {
  if (count === 1) return word;

  if (word === "person") return "people";
  if (word.endsWith("s")) return word;
  return word + "s";
}

function buildSentence(countMap) {
  const parts = [];

  for (const name in countMap) {
    const count = countMap[name];
    parts.push(count + " " + pluralize(name, count));
  }

  if (parts.length === 0) return "I see nothing";

  return "I see " + parts.join(", ");
}

// ---------- Camera ----------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = () => resolve();
    });

    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

  } catch (err) {
    alert("Camera access denied or unsupported");
    console.error(err);
    statusText.innerText = "Camera error";
  }
}

// ---------- Detection Loop ----------
async function detectFrame() {
  if (!model || video.readyState !== 4) {
    requestAnimationFrame(detectFrame);
    return;
  }

  const predictions = await model.detect(video);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const countMap = {};

  predictions.forEach(pred => {
    if (pred.score < 0.6) return;

    const [x, y, w, h] = pred.bbox;

    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#00d4ff";
    ctx.font = "18px Arial";
    ctx.fillText(
      pred.class + " " + Math.round(pred.score * 100) + "%",
      x,
      y > 10 ? y - 5 : y + 20
    );

    countMap[pred.class] = (countMap[pred.class] || 0) + 1;
  });

  const sentence = buildSentence(countMap);
  statusText.innerText = sentence;
  speak(sentence);

  requestAnimationFrame(detectFrame);
}

// ---------- Init ----------
async function init() {
  statusText.innerText = "Loading AI model...";
  model = await cocoSsd.load();

  statusText.innerText = "Starting camera...";
  await startCamera();

  statusText.innerText = "Detecting objects...";
  detectFrame();
}

// ---------- Start ----------
init();


// ---------- OPTIONAL: Change language examples ----------
// setLanguage("hi-IN"); // Hindi
// setLanguage("mr-IN"); // Marathi
// setLanguage("en-US"); // English
