const video = document.getElementById("video");
let model;
let lastSpoken = "";
let isSpeaking = false;

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
}

function speak(text) {
  if (isSpeaking || text === lastSpoken) return;

  const utter = new SpeechSynthesisUtterance(text);
  isSpeaking = true;

  utter.onend = () => {
    isSpeaking = false;
    lastSpoken = text;
  };

  speechSynthesis.speak(utter);
}

async function detectObjects() {
  const predictions = await model.detect(video);

  if (predictions.length === 0) {
    speak("I do not see anything clearly.");
    return;
  }

  let objects = predictions.map(p => p.class);

  let sentence = "";

  if (objects.length === 1) {
    sentence = `I see a ${objects[0]}.`;
  } else {
    sentence = `I see ${objects.length} objects: ${objects.join(", ")}.`;
  }

  speak(sentence);
}

async function main() {
  document.getElementById("status-text").textContent = "Starting camera...";
  await initCamera();

  document.getElementById("status-text").textContent = "Loading AI model...";
  model = await cocoSsd.load();

  document.getElementById("status-text").textContent = "Detecting objects...";

  setInterval(detectObjects, 1500);
}

main();
