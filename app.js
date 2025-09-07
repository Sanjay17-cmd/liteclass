let manifest = null;
let slideBlobs = [];   // [{url, at}]
let audioURL = null;
let currentIndex = 0;

const zipInput = document.getElementById('zipInput');
const loadStatus = document.getElementById('loadStatus');
const audio = document.getElementById('player');
const slideImg = document.getElementById('slide');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

zipInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadStatus.textContent = 'Loading ZIP...';

  try {
    const zip = await JSZip.loadAsync(file);
    // Read manifest
    const manifestText = await zip.file('manifest.json').async('string');
    manifest = JSON.parse(manifestText);

    // Load audio blob
    const audioFile = zip.file(manifest.audio);
    if (!audioFile) { loadStatus.textContent = 'Audio file missing in ZIP'; return; }
    const audioBlob = await audioFile.async('blob');
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(audioBlob);
    audio.src = audioURL;

    // Load slides as blobs and map to times
    slideBlobs = [];
    for (const s of manifest.slides) {
      const f = zip.file(s.file);
      if (!f) continue;
      const b = await f.async('blob');
      const url = URL.createObjectURL(b);
      slideBlobs.push({ url, at: Number(s.at) || 0 });
    }

    // Sort by time just in case
    slideBlobs.sort((a,b) => a.at - b.at);

    // Show first slide
    currentIndex = 0;
    slideImg.src = slideBlobs[0]?.url || '';
    loadStatus.textContent = `Loaded: ${manifest.title} (${slideBlobs.length} slides)`;
  } catch (err) {
    console.error(err);
    loadStatus.textContent = 'Error reading ZIP. Ensure it contains manifest.json, audio/, slides/';
  }
});

// Slide helpers
function showSlide(i) {
  if (!slideBlobs.length) return;
  currentIndex = Math.max(0, Math.min(i, slideBlobs.length - 1));
  slideImg.src = slideBlobs[currentIndex].url;
}

prevBtn.onclick = () => showSlide(currentIndex - 1);
nextBtn.onclick = () => showSlide(currentIndex + 1);

// Auto slide sync with audio currentTime
let syncTimer = null;

function startSync() {
  if (!slideBlobs.length) return;
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    const t = Math.floor(audio.currentTime || 0);
    // Find last slide whose "at" <= t
    let idx = 0;
    for (let i = 0; i < slideBlobs.length; i++) {
      if (slideBlobs[i].at <= t) idx = i; else break;
    }
    if (idx !== currentIndex) showSlide(idx);
  }, 500);
}

startBtn.onclick = () => {
  audio.play();
  startSync();
};

resetBtn.onclick = () => {
  if (syncTimer) clearInterval(syncTimer);
  audio.pause();
  audio.currentTime = 0;
  showSlide(0);
};

// Optional: clean up object URLs on page unload
window.addEventListener('beforeunload', () => {
  if (audioURL) URL.revokeObjectURL(audioURL);
  for (const s of slideBlobs) URL.revokeObjectURL(s.url);
});
