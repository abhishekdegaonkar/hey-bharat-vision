/* script.js
   Hey India — Modern web demo
   - Wake word: "hey india"
   - Uses Web Speech API for wake word
   - Uses TensorFlow.js coco-ssd for object detection
   - Speaks results using SpeechSynthesis
   - Camera fallback for laptops & phones
   - Explicitly requests mic permission for more reliable behavior
*/

let recognition = null;
let listening = false;
let continuousWake = true;
let model = null;

const WAKE_PHRASE = "hey india";
const COMMAND_KEYWORDS = [
  "what is in front of me",
  "describe",
  "what do you see",
  "identify",
  "look",
  "describe my surroundings",
  "what's in front",
  "tell me what you see",
  "what is there"
];

const ANIMAL_LABELS = new Set(["dog","cat","bird","horse","sheep","cow","elephant","bear","zebra","giraffe"]);
const PLANT_LABELS = new Set(["potted plant","plant","tree"]);

const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");
const lastResponse = document.getElementById("last-response");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const continuousToggle = document.getElementById("continuous-toggle");
const video = document.getElementById("video");
const canvas = document.getElementById("capture-canvas");
const ding = document.getElementById("ding");

// helpers
function logStatus(s, color = null){
  console.log("[Hey India]", s);
  statusText.textContent = s;
  if(color) statusDot.style.background = color;
}

function speak(text){
  lastResponse.textContent = text;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  console.log("[Hey India] speak:", text);
}
function vibe(pattern){ if(navigator.vibrate) navigator.vibrate(pattern); }

// Camera init with fallback (environment preferred, fallback to default)
async function startCamera(){
  try{
    // try back camera first (phones)
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = stream;
    await video.play();
    logStatus("camera ready", null);
    return true;
  }catch(e){
    console.warn("back-facing camera not available, falling back:", e);
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      await video.play();
      logStatus("camera ready (default)", null);
      return true;
    }catch(err){
      console.error("camera error:", err);
      logStatus("camera not available", "#c2410c");
      speak("Camera permission denied or not available.");
      return false;
    }
  }
}

// ensure microphone permission is granted (some browsers need explicit getUserMedia audio)
async function ensureMicrophonePermission(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("getUserMedia not supported for microphone");
    return false;
  }
  try{
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop tracks - we only wanted permission
    s.getTracks().forEach(t => t.stop());
    console.log("microphone permission granted");
    return true;
  }catch(e){
    console.warn("microphone permission denied", e);
    return false;
  }
}

// load COCO-SSD model
async function loadModel(){
  try{
    logStatus("loading model...");
    model = await cocoSsd.load();
    logStatus("model loaded. Ready.");
  }catch(e){
    console.error("model load failed", e);
    logStatus("model load failed", "#c2410c");
  }
}

// capture frame
function captureFrame(){
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

// analyze frame
async function analyzeScene(){
  if(!model){
    logStatus("model not loaded", "#c2410c");
    speak("Model not ready. Please wait and try again.");
    return;
  }
  try{
    logStatus("processing image...");
    vibe([60]);
    const cap = captureFrame();
    const preds = await model.detect(cap);
    if(!preds || preds.length === 0){
      logStatus("no objects detected");
      speak("I couldn't detect anything. Please move the camera slowly.");
      return;
    }
    const labels = new Set(preds.map(p => p.class));
    const people = [...labels].filter(l => l === "person");
    const animals = [...labels].filter(l => ANIMAL_LABELS.has(l));
    const plants = [...labels].filter(l => PLANT_LABELS.has(l));
    const others = [...labels].filter(l => l !== "person" && !ANIMAL_LABELS.has(l) && !PLANT_LABELS.has(l));

    const parts = [];
    if(people.length) parts.push(people.length === 1 ? "a person" : `${people.length} people`);
    if(animals.length) parts.push(animals.join(", "));
    if(plants.length) parts.push(plants.join(", "));
    if(others.length) parts.push(others.slice(0,3).join(", "));

    const sentence = parts.length ? `I see ${parts.join(" and ")}.` : "I see something but I can't describe it clearly.";
    logStatus("done");
    vibe([30,20,30]);
    speak(sentence);
  }catch(e){
    console.error("analysis error", e);
    logStatus("error analyzing scene", "#c2410c");
    speak("There was an error analyzing the scene.");
  }
}

// single-shot speech listener
function listenForCommandOnce(timeoutMs = 5000){
  return new Promise((resolve, reject) => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRec){
      reject(new Error("SpeechRecognition not supported"));
      return;
    }
    const r = new SpeechRec();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;

    let fired = false;
    r.onresult = (ev) => {
      fired = true;
      const txt = ev.results[0][0].transcript.toLowerCase().trim();
      try{ r.stop(); }catch(e){}
      resolve(txt);
    };
    r.onerror = (ev) => {
      try{ r.stop(); }catch(e){}
      reject(ev.error || new Error("speech error"));
    };
    r.onend = () => {
      if(!fired) resolve("");
    };
    r.start();
    setTimeout(()=>{ try{ r.stop(); }catch(_){} }, timeoutMs);
  });
}

// wake-listening continuous recognizer with robust restart
function startWakeRecognition(){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){
    logStatus("SpeechRecognition not supported", "#c2410c");
    speak("Speech recognition not supported in your browser. Please use Chrome.");
    return;
  }

  recognition = new SpeechRec();
  recognition.continuous = continuousWake;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    logStatus("listening for wake phrase...", "#06b6d4");
    console.log("[Hey India] recognition started");
  };
  recognition.onerror = (ev) => {
    console.warn("recognition error", ev);
  };
  recognition.onend = () => {
    listening = false;
    logStatus("stopped listening");
    console.log("[Hey India] recognition ended");
    // restart for continuous mode
    if(continuousWake && startBtn.disabled){
      setTimeout(()=> {
        try{ recognition.start(); }catch(e){}
      }, 300);
    }
  };

  recognition.onresult = async (ev) => {
    const text = ev.results[ev.results.length - 1][0].transcript.toLowerCase().trim();
    console.log("[Hey India] heard:", text);
    if(text.includes(WAKE_PHRASE)){
      logStatus("wake phrase heard");
      ding.currentTime = 0; ding.play();
      vibe([40]);
      try{
        logStatus("listening for command...");
        const cmd = await listenForCommandOnce(4500);
        console.log("[Hey India] command:", cmd);
        const matched = COMMAND_KEYWORDS.some(k => cmd.includes(k));
        if(matched || cmd === "" || cmd.length < 2){
          logStatus("capturing image...");
          await analyzeScene();
        } else {
          const phr = cmd.toLowerCase();
          if(phr.includes("see") || phr.includes("front") || phr.includes("describe") || phr.includes("what")){
            logStatus("capturing image (fallback)...");
            await analyzeScene();
          } else {
            logStatus("command not recognized");
            speak("Command not recognized. Try saying: What is in front of me?");
          }
        }
      }catch(err){
        console.error("command listen err", err);
        logStatus("error capturing command", "#c2410c");
        speak("I couldn't hear your command. Please try again.");
      }
    }
  };

  try{
    recognition.start();
  }catch(e){
    console.warn("recognition start fail", e);
  }
}

// stop recognition + camera cleanup
function stopWakeRecognition(){
  if(recognition){
    try{ recognition.onresult = null; recognition.onend = null; recognition.stop(); }catch(e){}
    recognition = null;
  }
  listening = false;
}

// UI wiring
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  continuousWake = continuousToggle.checked;
  logStatus("initializing...");

  // ensure mic permission (improves reliability on some systems)
  const micOk = await ensureMicrophonePermission();
  if(!micOk){
    speak("Microphone access denied. Please allow microphone and try again.");
    startBtn.disabled = false; stopBtn.disabled = true;
    return;
  }

  const camOk = await startCamera();
  if(!camOk){
    startBtn.disabled = false; stopBtn.disabled = true;
    return;
  }
  if(!model) await loadModel();
  startWakeRecognition();
});

stopBtn.addEventListener('click', () => {
  stopWakeRecognition();
  // stop camera tracks
  try{
    const stream = video.srcObject;
    if(stream){
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
  }catch(e){}

  startBtn.disabled = false;
  stopBtn.disabled = true;
  logStatus("idle");
});

// restart recognizer when toggle changes
continuousToggle.addEventListener('change', () => {
  if(listening){
    stopWakeRecognition();
    setTimeout(()=> startWakeRecognition(), 250);
  }
});

// initial state
logStatus("idle");

// preload model quietly
window.addEventListener('load', async () => {
  try{
    model = await cocoSsd.load();
    console.log("model preloaded");
  }catch(e){
    console.warn("model preload failed", e);
  }
});
