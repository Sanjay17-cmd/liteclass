// student.js

let audioEl = document.getElementById("class-audio");
let slides = [];
let timeline = [];
let currentSlide = 0;
let isPlaying = false;

// Parse "00:10 -> 2" into { time: 10, slide: 2 }
function parseTimeline(raw) {
  return raw.split("\n").map(line => {
    const [timeStr, slideStr] = line.split("->").map(s => s.trim());
    const [mm, ss] = timeStr.split(":").map(Number);
    return { time: mm * 60 + ss, slide: parseInt(slideStr, 10) - 1 };
  });
}

// Load ZIP (from file input or localStorage string)
async function loadZip(blob) {
  const zip = await JSZip.loadAsync(blob);

  // Read metadata.json
  const metadata = JSON.parse(await zip.file("metadata.json").async("string"));
  document.getElementById("class-info").classList.remove("hidden");
  document.getElementById("class-subject").textContent = metadata.subject;
  document.getElementById("class-teacher").textContent = metadata.teacher;
  document.getElementById("class-date").textContent = metadata.date;
  document.getElementById("class-time").textContent = metadata.time;

  timeline = parseTimeline(metadata.timeline);

  // Load audio
  const audioBlob = await zip.file("audio.webm").async("blob");
  audioEl.src = URL.createObjectURL(audioBlob);

  // Load slides
  slides = [];
  const slideFiles = zip.folder("slides").file(/.*/);
  for (let i = 0; i < slideFiles.length; i++) {
    const data = await slideFiles[i].async("blob");
    slides.push(URL.createObjectURL(data));
  }
  currentSlide = 0;
  renderSlide();
}

// Render current slide
function renderSlide() {
  const container = document.getElementById("slides-container");
  container.innerHTML = "";
  if (slides.length > 0) {
    const img = document.createElement("img");
    img.src = slides[currentSlide];
    img.style.maxWidth = "500px";
    img.style.display = "block";
    container.appendChild(img);
  }
}

// -----------------------------
// Controls
// -----------------------------

// Start / Pause / Resume
document.getElementById("start-btn").addEventListener("click", () => {
  if (!isPlaying) {
    audioEl.play();
    isPlaying = true;
    document.getElementById("start-btn").textContent = "Pause";
  } else if (!audioEl.paused) {
    audioEl.pause();
    document.getElementById("start-btn").textContent = "Resume";
  } else {
    audioEl.play();
    document.getElementById("start-btn").textContent = "Pause";
  }
});

// Reset
document.getElementById("reset-btn").addEventListener("click", () => {
  audioEl.pause();
  audioEl.currentTime = 0;
  currentSlide = 0;
  renderSlide();
  isPlaying = false;
  document.getElementById("start-btn").textContent = "Start";
});

// Prev / Next slide
document.getElementById("prev-slide").addEventListener("click", () => {
  if (currentSlide > 0) {
    currentSlide--;
    renderSlide();
  }
});
document.getElementById("next-slide").addEventListener("click", () => {
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide();
  }
});

// Skip ±10s
document.getElementById("back-10").addEventListener("click", () => {
  audioEl.currentTime = Math.max(0, audioEl.currentTime - 10);
});
document.getElementById("forward-10").addEventListener("click", () => {
  audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 10);
});

// Sync slides with timeline while playing
audioEl.addEventListener("timeupdate", () => {
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (audioEl.currentTime >= timeline[i].time) {
      currentSlide = timeline[i].slide;
      renderSlide();
      break;
    }
  }
});

// -----------------------------
// Load from cache or file
// -----------------------------

// -----------------------------
// Toggle saved classes from cache
// -----------------------------
let cacheVisible = false;

document.getElementById("show-cache").addEventListener("click", () => {
  const list = document.getElementById("cache-list");
  const btn = document.getElementById("show-cache");

  if (cacheVisible) {
    // hide list
    list.innerHTML = "";
    btn.textContent = "Show Saved Classes";
    cacheVisible = false;
    return;
  }

  // show list
  list.innerHTML = "";
  const keys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));
  if (keys.length === 0) {
    list.innerHTML = "<li>No saved classes</li>";
  } else {
    keys.forEach(key => {
      const li = document.createElement("li");
      li.textContent = key;

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.style.marginLeft = "10px";
      loadBtn.addEventListener("click", () => {
        const base64Data = localStorage.getItem(key);
        fetch(base64Data).then(res => res.blob()).then(blob => loadZip(blob));
      });

      li.appendChild(loadBtn);
      list.appendChild(li);
    });
  }

  btn.textContent = "Hide Saved Classes";
  cacheVisible = true;
});


document.getElementById("load-zip").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    loadZip(file);
  }
});
