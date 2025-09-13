// teacher.js

// -----------------------------
// Tab switching
// -----------------------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // remove active from all
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    // add active to clicked
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// -----------------------------
// Save pre-recorded class offline
// -----------------------------
document.getElementById("pre-save")?.addEventListener("click", async () => {
  const subject = document.getElementById("pre-subject").value.trim();
  const date = document.getElementById("pre-date").value;
  const time = document.getElementById("pre-time").value;
  const audio = document.getElementById("pre-audio").files[0];
  const slides = Array.from(document.getElementById("pre-slides").files);
  const timeline = document.getElementById("pre-timeline").value.trim();

  if (!subject || !date || !time || !audio || slides.length === 0 || !timeline) {
    document.getElementById("pre-status").textContent = "⚠️ Please fill all fields!";
    return;
  }

const teacherName = document.getElementById("pre-teacher").value.trim() || "Unknown";

  const metadata = {
    subject,
    date,
    time,
    teacher: teacherName,
    timeline
  };

  const zip = new JSZip();
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("audio.webm", audio);

  const slidesFolder = zip.folder("slides");
  slides.forEach(file => slidesFolder.file(file.name, file));

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${subject}_${date}_${time}.zip`;

  // 👉 1. Download immediately
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // 👉 2. Save to cache (localStorage as base64)
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(filename, reader.result);
    document.getElementById("pre-status").textContent = "✅ Saved to cache: " + filename;
  };
  reader.readAsDataURL(blob);
});

// -----------------------------
// Show saved pre-recorded classes
// -----------------------------
document.getElementById("pre-list")?.addEventListener("click", () => {
  const list = document.getElementById("pre-saved-list");
  list.innerHTML = "";

  const keys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));
  if (keys.length === 0) {
    list.innerHTML = "<li>No saved classes</li>";
    return;
  }

  keys.forEach(key => {
    const li = document.createElement("li");
    li.textContent = key;
    list.appendChild(li);
  });
});

// -----------------------------
// Teacher Offline Recorder
// -----------------------------
let recMediaRecorder;
let recChunks = [];
let recSlides = [];
let recCurrentSlide = 0;
let recTimeline = [];
let recStartTime = 0;
let recState = "idle"; // idle | recording | paused

// Render current recording slide
function renderRecSlide() {
  const container = document.getElementById("rec-slides-container");
  container.innerHTML = "";
  if (recSlides.length > 0) {
    const img = document.createElement("img");
    img.src = recSlides[recCurrentSlide];
    img.style.maxWidth = "400px";
    img.style.display = "block";
    container.appendChild(img);
  }
}

// Format seconds as mm:ss
function formatTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Start / Pause / Resume recording
document.getElementById("rec-toggle")?.addEventListener("click", async () => {
  const btn = document.getElementById("rec-toggle");

  if (recState === "idle") {
    const subject = document.getElementById("rec-subject").value.trim();
    const date = document.getElementById("rec-date").value;
    const time = document.getElementById("rec-time").value;
    const slideFiles = Array.from(document.getElementById("rec-slides").files);

    if (!subject || !date || !time || slideFiles.length === 0) {
      alert("Fill subject, date, time, and select slides!");
      return;
    }

    // Load slides
    recSlides = [];
    for (let file of slideFiles) {
      recSlides.push(URL.createObjectURL(file));
    }
    recCurrentSlide = 0;
    recTimeline = [];
    renderRecSlide();

    // Setup audio
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recMediaRecorder = new MediaRecorder(stream);
    recChunks = [];
    recStartTime = Date.now();

    recMediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recChunks.push(e.data);
    };

    recMediaRecorder.start();
    recState = "recording";
    btn.textContent = "Pause";
    document.getElementById("rec-stop").disabled = false;
    document.getElementById("rec-prev-slide").disabled = false;
    document.getElementById("rec-next-slide").disabled = false;
    
    document.getElementById("rec-status").textContent = "Recording... Use Next/Prev to change slides.";
  } else if (recState === "recording") {
    recMediaRecorder.pause();
    recState = "paused";
    btn.textContent = "Resume";
} else if (recState === "paused") {
  recMediaRecorder.resume();
  recState = "recording";
  btn.textContent = "Pause";
  document.getElementById("rec-status").textContent = "Recording resumed...";
  renderRecSlide(); // ensure it stays on the current slide
}
});

// Stop recording
document.getElementById("rec-stop")?.addEventListener("click", () => {
  recMediaRecorder.stop();
  recState = "idle";
  document.getElementById("rec-stop").disabled = true;
  document.getElementById("rec-toggle").textContent = "Start";
  document.getElementById("rec-save").disabled = false;
  document.getElementById("rec-upload").disabled = false;
  document.getElementById("rec-status").textContent = "Recording stopped.";
});

// Slide controls during recording
document.getElementById("rec-prev-slide")?.addEventListener("click", () => {
  if (recCurrentSlide > 0) {
    recCurrentSlide--;
    renderRecSlide();
    const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
    recTimeline.push(`${formatTime(elapsed)} -> ${recCurrentSlide + 1}`);
  }
});
document.getElementById("rec-next-slide")?.addEventListener("click", () => {
  if (recCurrentSlide < recSlides.length - 1) {
    recCurrentSlide++;
    renderRecSlide();
    const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
    recTimeline.push(`${formatTime(elapsed)} -> ${recCurrentSlide + 1}`);
  }
});

// Save as ZIP
document.getElementById("rec-save")?.addEventListener("click", async () => {
  const subject = document.getElementById("rec-subject").value.trim();
  const date = document.getElementById("rec-date").value;
  const time = document.getElementById("rec-time").value;
  const teacherName = document.getElementById("rec-teacher").value.trim() || "Unknown";

  const audioBlob = new Blob(recChunks, { type: "audio/webm" });

  const metadata = {
    subject,
    date,
    time,
    teacher: teacherName,
    timeline: recTimeline.join("\n")
  };

  const zip = new JSZip();
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("audio.webm", audioBlob);

  const slidesFolder = zip.folder("slides");
  const slideFiles = Array.from(document.getElementById("rec-slides").files);
  slideFiles.forEach(file => slidesFolder.file(file.name, file));

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${subject}_${date}_${time}.zip`;

  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Save to cache
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(filename, reader.result);
    alert("Recorded class saved offline!");
  };
  reader.readAsDataURL(blob);
});
