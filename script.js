let model;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");

// -------- Language --------
let currentLang = "en-US"; // en-US | hi-IN | mr-IN

function setLanguage(langCode) {
  currentLang = langCode;
}

// -------- Speech --------
const tts = window.speechSynthesis;
let lastSentence = "";
let lastSpeakTime = 0;

function speak(text) {
  const now = Date.now();
  if (text === lastSentence && now - lastSpeakTime < 2500) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLang;
  utter.rate = 1;

  tts.cancel();
  tts.speak(utter);

  lastSentence = text;
  lastSpeakTime = now;
}

// -------- Greeting Based on Time --------
function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function speakWelcome() {
  const greeting = getGreeting();
  speak(`Hello, ${greeting}. I am Hey Bharat Vision. I am your digital eyes.`);
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
  return "at medium distance";
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
  const distanceMap = {};

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

    // Count objects
    countMap[pred.class] = (countMap[pred.class] || 0) + 1;

    // Track closest distance for each object type
    if (!distanceMap[pred.class] || distance === "very close") {
      distanceMap[pred.class] = distance;
    }
  });

  // Build Speech Sentence
  let speechParts = [];

  for (const name in countMap) {
    const count = countMap[name];
    const distance = distanceMap[name];

    const objectName = pluralize(name, count);

    if (distance === "very close") {
      speechParts.push(`${count} ${objectName} ${count > 1 ? "are" : "is"} very close`);
    } else if (distance === "close") {
      speechParts.push(`${count} ${objectName} ${count > 1 ? "are" : "is"} close`);
    }
  }

  // Normal detection sentence
  const normalParts = [];
  for (const name in countMap) {
    normalParts.push(countMap[name] + " " + pluralize(name, countMap[name]));
  }

  const normalSentence =
    normalParts.length > 0
      ? "I see " + normalParts.join(", ")
      : "I see nothing";

  statusText.innerText = normalSentence;

  if (speechParts.length > 0) {
    speak(speechParts.join(". "));
  } else {
    speak(normalSentence);
  }

  requestAnimationFrame(detectFrame);
}

// -------- Init --------
async function init() {
  statusText.innerText = "Loading AI model...";
  model = await cocoSsd.load();

  speakWelcome(); // Greeting

  statusText.innerText = "Starting camera...";
  await startCamera();

  statusText.innerText = "Detecting objects...";
  detectFrame();
}

init();
