let model;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");

// -------- Language --------
let currentLang = "en-US";

function setLanguage(langCode) {
  currentLang = langCode;
}

// -------- Speech --------
const tts = window.speechSynthesis;
let lastSentence = "";
let lastSpeakTime = 0;

function speak(text) {
  const now = Date.now();
  if (text === lastSentence && now - lastSpeakTime < 3000) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLang;

  tts.cancel();
  tts.speak(utter);

  lastSentence = text;
  lastSpeakTime = now;
}

// -------- Grammar --------
function pluralize(word, count) {
  if (count === 1) return word;
  if (word === "person") return "people";
  if (word.endsWith("s")) return word;
  return word + "s";
}

// -------- Distance --------
function getDistanceLevel(width, videoWidth) {
  const ratio = width / videoWidth;

  if (ratio > 0.65) return "very close";
  if (ratio > 0.45) return "close";
  if (ratio < 0.20) return "far";
  return "medium distance";
}

// -------- Camera --------
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
    alert("Camera access denied");
    console.error(err);
  }
}

// -------- Detection --------
async function detectFrame() {
  if (!model || video.readyState !== 4) {
    requestAnimationFrame(detectFrame);
    return;
  }

  const predictions = await model.detect(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const countMap = {};
  let personCount = 0;
  let danger = false;

  predictions.forEach(pred => {
    if (pred.score < 0.6) return;

    const [x, y, w, h] = pred.bbox;
    const distance = getDistanceLevel(w, video.videoWidth);

    ctx.strokeStyle = distance === "very close" ? "red" : "#00d4ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "18px Arial";
    ctx.fillText(
      `${pred.class} (${distance})`,
      x,
      y > 10 ? y - 5 : y + 20
    );

    countMap[pred.class] = (countMap[pred.class] || 0) + 1;

    if (pred.class === "person") {
      personCount++;
      if (distance === "very close") {
        danger = true;
        speak("Warning! Person is very close");
      }
    }
  });

  if (personCount > 3) {
    speak("Alert! More than three people detected");
  }

  canvas.style.boxShadow = danger ? "0 0 40px red" : "none";

  const parts = [];
  for (const name in countMap) {
    parts.push(
      countMap[name] + " " + pluralize(name, countMap[name])
    );
  }

  const sentence =
    parts.length > 0
      ? "I see " + parts.join(", ")
      : "I see nothing";

  statusText.innerText = sentence;
  speak(sentence);

  requestAnimationFrame(detectFrame);
}

// -------- Init --------
async function init() {
  statusText.innerText = "Loading AI model...";
  model = await cocoSsd.load();

  statusText.innerText = "Starting camera...";
  await startCamera();

  statusText.innerText = "Detecting objects...";
  detectFrame();
}

init();
