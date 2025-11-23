/* script.js
   Hey India — Browser demo (updated)
   - Uses Web Speech API for wake word
   - Uses TensorFlow.js coco-ssd for object detection
   - Speaks results using SpeechSynthesis
   - Detects people (no names), animals, plants, and objects
*/

let recognition;
let listening = false;
let active = false; // active after wake word
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
  "tell me what you see"
];

const statusText = document.getElementById("status-text");
const lastResponse = document.getElementById("last-response");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const continuousToggle = document.getElementById("continuous-toggle");
const video = document.getElementById("video");
const canvas = document.getElementById("capture-canvas");
const ding = document.getElementById("ding");

// animal labels to emphasize
const ANIMAL_LABELS = new Set(["dog","cat","bird","horse","sheep","cow","elephant","bear","zebra","giraffe"]);
const PLANT_LABELS = new Set(["potted plant","plant","tree"]);

// helper: update UI status
function setStatus(s){
  console.log("[Hey India] status:", s);
  statusText.textContent = s;
}

// vibrate helper
function vibe(pattern){ if(navigator.vibrate) navigator.vibrate(pattern); }

// speak helper
function speak(text){
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'en-IN'; // Indian English
  speechSynthesis.cancel(); // stop previous
  speechSynthesis.speak(ut);
  lastResponse.textContent = text;
  console.log("[Hey India] speak:", text);
}

// init camera
async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}, audio:false});
    video.srcObject = stream;
    await video.play();
    return true;
  }catch(e){
    console.error("camera error", e);
    setStatus("camera permission denied or not available");
    speak("Camera permission denied or not available.");
    return false;
  }
}

// load model
async function loadModel(){
  setStatus("loading model...");
  model = await cocoSsd.load();
  setStatus("model loaded. Ready.");
}

// capture frame to canvas
function captureFrame(){
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

// detect objects and craft response
async function analyzeScene(){
  try{
    setStatus("processing image...");
    vibe([60]); // once when processing starts
    const cap = captureFrame();
    const predictions = await model.detect(cap);
    if(!predictions || predictions.length === 0){
      setStatus("no objects detected");
      speak("I couldn't detect anything. Please move the camera slowly.");
      return;
    }

    // aggregate labels (unique)
    const labels = new Set();
    predictions.forEach(p => labels.add(p.class));

    // classify into buckets
    const detectedPeople = [...labels].filter(l => l === "person");
    const detectedAnimals = [...labels].filter(l => ANIMAL_LABELS.has(l));
    const detectedPlants = [...labels].filter(l => PLANT_LABELS.has(l));
    const otherObjects = [...labels].filter(l => l !== "person" && !ANIMAL_LABELS.has(l) && !PLANT_LABELS.has(l));

    // build readable phrase pieces
    const parts = [];
    if(detectedPeople.length) parts.push(detectedPeople.length === 1 ? "a person" : `${detectedPeople.length} people`);
    if(detectedAnimals.length) parts.push(detectedAnimals.join(", "));
    if(detectedPlants.length) parts.push(detectedPlants.join(", "));
    if(otherObjects.length) {
      // show up to 3 other objects
      const o = otherObjects.slice(0,3);
      parts.push(o.join(", "));
    }

    const sentence = parts.length ? `I see ${parts.join(" and ")}.` : "I see something but I can't describe it clearly.";
    setStatus("done");
    vibe([30,20,30]); // two short pulses to indicate done
    speak(sentence);
  }catch(e){
    console.error("analysis error", e);
    setStatus("error during analysis");
    speak("There was an error analyzing the scene.");
  }
}

// single-shot command listener after wake
function listenForCommandOnce(timeoutMs = 5000){
  return new Promise((resolve, reject) => {
    if(!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)){
      reject(new Error("SpeechRecognition not supported"));
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SpeechRec();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;

    let fired = false;
    r.onresult = (ev) => {
      fired = true;
      const text = ev.results[0][0].transcript.toLowerCase().trim();
      r.stop();
      resolve(text);
    };
    r.onerror = (ev) => {
      r.stop();
      reject(ev.error || new Error("speech error"));
    };
    r.onend = () => {
      if(!fired) resolve(""); // no speech captured
    };
    r.start();

    // safety timeout
    setTimeout(()=>{ try{ r.stop(); }catch(_){} }, timeoutMs);
  });
}

// wake-listening continuous recognizer
function startWakeRecognition(){
  if(!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)){
    setStatus("SpeechRecognition not supported in this browser.");
    speak("Speech recognition is not supported in your browser. Try Chrome on Android or desktop.");
    return;
  }

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.continuous = continuousWake;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    setStatus("listening for wake phrase...");
    console.log("[Hey India] recognition started");
  };

  recognition.onerror = (ev) => {
    console.warn("recog error", ev);
  };

  recognition.onend = () => {
    listening = false;
    setStatus("stopped listening");
    console.log("[Hey India] recognition ended");
    // if continuous mode and still active UI says start, restart it
    if(continuousWake && startBtn.disabled) {
      // restart automatically after short delay
      setTimeout(()=> {
        try { recognition.start(); } catch(e){ /* ignore */ }
      }, 300);
    }
  };

  recognition.onresult = async (ev) => {
    const text = ev.results[ev.results.length - 1][0].transcript.toLowerCase().trim();
    console.log("heard:", text);
    // if we catch wake phrase anywhere in the recognized text
    if(text.includes(WAKE_PHRASE)){
      // Activate
      setStatus('wake phrase heard');
      ding.currentTime = 0; ding.play();
      vibe([40]);
      // after ding, listen for a command for a short duration
      try{
        setStatus('listening for command...');
        const cmd = await listenForCommandOnce(4500);
        console.log("command:", cmd);
        const matched = COMMAND_KEYWORDS.some(k => cmd.includes(k));
        // If command clearly matches or if user said nothing assume they want scene description
        if(matched || cmd === "" || cmd.length < 2){
          setStatus("capturing image...");
          await analyzeScene();
        } else {
          // maybe user used different phrasing but still wants scene -> fallback to analyze
          const phr = cmd.toLowerCase();
          if(phr.includes("see") || phr.includes("front") || phr.includes("describe") || phr.includes("what")){
            setStatus("capturing image (fallback)...");
            await analyzeScene();
          } else {
            setStatus("command not recognized");
            speak("Command not recognized. Try saying: What is in front of me?");
          }
        }
      }catch(err){
        console.error("command listen err", err);
        setStatus("error capturing command");
        speak("I couldn't hear your command. Please try again.");
      }
    } // end if wake
  };

  try{
    recognition.start();
  }catch(e){
    console.warn("start error:", e);
  }
}

// stop recognizer
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
  setStatus("initializing...");
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
  setStatus("idle");
});

// allow toggle change during runtime
continuousToggle.addEventListener('change', () => {
  // restart if running
  if(listening){
    stopWakeRecognition();
    setTimeout(()=> startWakeRecognition(), 250);
  }
});

// initial UI state
setStatus("idle");

// optional: warm up model on load quietly
window.addEventListener('load', async () => {
  // attempt to load the model in background so it's faster when user starts
  try{
    model = await cocoSsd.load();
    console.log("model preloaded");
  }catch(e){
    console.warn("model preload failed", e);
  }
});
