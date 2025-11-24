async function startUniversalCamera() {
  try {
    // Try back camera first
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" } // back camera
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } 
  catch (err1) {
    console.warn("Back camera not available, trying front camera…");

    try {
      // Try front camera
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      video.srcObject = fallbackStream;
    } 
    catch (err2) {
      alert("Camera unavailable on this device.");
      console.error(err2);
    }
  }
}

startUniversalCamera();

