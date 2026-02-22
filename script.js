const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");

let model;
let lastSpoken = "";
let lastSpeakTime = 0;

// 🌅 Smart Greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

// 🔊 Speak Function
function speak(text) {
  const now = Date.now();
  if (text === lastSpoken && now - lastSpeakTime < 4000) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  speechSynthesis.speak(utterance);

  lastSpoken = text;
  lastSpeakTime = now;
}

// 🎤 Welcome Message
function welcomeMessage() {
  const greeting = getGreeting();
  speak(`I am Hey Bharat Vision. I am your digital eyes. ${greeting}.`);
}

// 📷 Start Camera
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => resolve(video);
  });
}

// 📦 Load Model
async function loadModel() {
  statusText.innerText = "Loading AI Model...";
  model = await cocoSsd.load();
  statusText.innerText = "Model Loaded. Starting camera...";
}

// 📊 Distance Logic
function isVeryClose(width) {
  return width > video.width * 0.5;
}

// 🎯 Detection Loop
async function detect() {
  const predictions = await model.detect(video);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let objectCounts = {};
  let closeObjects = [];

  predictions.forEach(prediction => {
    const [x, y, width, height] = prediction.bbox;

    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#00ffcc";
    ctx.fillText(prediction.class, x, y > 10 ? y - 5 : 10);

    objectCounts[prediction.class] = 
      (objectCounts[prediction.class] || 0) + 1;

    if (isVeryClose(width)) {
      closeObjects.push(prediction.class);
    }
  });

  let speechText = "";

  // Count Objects
  for (let object in objectCounts) {
    const count = objectCounts[object];
    if (count === 1) {
      speechText += `One ${object}. `;
    } else {
      speechText += `${count} ${object}s. `;
    }
  }

  // Distance Warning
  if (closeObjects.length > 0) {
    closeObjects.forEach(obj => {
      speechText += `${obj} is very close. `;
    });
  }

  if (speechText !== "") {
    speak(speechText);
  }

  requestAnimationFrame(detect);
}

// 🚀 Initialize
async function init() {
  welcomeMessage();
  await loadModel();
  await setupCamera();
  detect();
}

init();
