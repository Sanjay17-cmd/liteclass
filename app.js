// app.js - liteclass logic using JSZip
const $ = id => document.getElementById(id);
const login = $('login-screen');
const teacher = $('teacher-screen');
const student = $('student-screen');
const admin = $('admin-screen');

$('teacher-btn').onclick = () => { login.classList.add('hidden'); teacher.classList.remove('hidden'); }
$('student-btn').onclick = () => { login.classList.add('hidden'); student.classList.remove('hidden'); }
$('admin-btn').onclick = () => { login.classList.add('hidden'); admin.classList.remove('hidden'); }

$('back-teacher').onclick = () => { teacher.classList.add('hidden'); login.classList.remove('hidden'); }
$('back-student').onclick = () => { student.classList.add('hidden'); login.classList.remove('hidden'); }
$('back-admin').onclick = () => { admin.classList.add('hidden'); login.classList.remove('hidden'); }

// Teacher side: Build class ZIP
$('build-zip').onclick = async () => {
  const name = $('teacher-name').value || 'Teacher';
  const subject = $('subject').value || 'Subject';
  const date = $('date').value || '';
  const time = $('time').value || '';
  const audioFile = $('audio-file').files[0];
  const slides = Array.from($('slides-files').files);
  const timingsStr = $('timings').value.trim();
  if (!audioFile || slides.length === 0) { 
    $('build-msg').textContent = 'Please provide audio and at least one slide.'; 
    return; 
  }
  const timings = timingsStr.split(',').map(s => s.trim()).filter(s => s).map(s => {
    const [mm, ss] = s.split(':').map(x => parseInt(x || '0', 10)); return (mm * 60) + ss;
  });
  // build metadata.json
  const meta = { teacher: name, subject, date, time, slides: slides.map(f => f.name), timings };
  const zip = new JSZip();
  zip.file('metadata.json', JSON.stringify(meta, null, 2));
  zip.file(audioFile.name, await audioFile.arrayBuffer());
  const slidesFolder = zip.folder('slides');
  for (const f of slides) { slidesFolder.file(f.name, await f.arrayBuffer()); }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const fname = `class_${subject}_${date || 'nodate'}_${time || 'notime'}.zip`.replace(/[: ]/g, '-');
  $('build-msg').innerHTML = `ZIP ready — <a id="dlzip" href="${url}" download="${fname}">download</a>. Use this zip on student side.`;
}

// Student side: Load class ZIP
let currentSlides = [], currentTimings = [], audioEl = $('audio'), slideImg = $('slide-img');
let slideIdx = 0, interval = null;

$('class-zip').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const jszip = new JSZip();
  const content = await jszip.loadAsync(file);
  
  // read metadata
  const metaText = await content.file('metadata.json').async('string');
  const meta = JSON.parse(metaText);
  $('class-meta').textContent = `Subject: ${meta.subject} — Date: ${meta.date} Time: ${meta.time}`;

  // ✅ Support more audio formats: .mp3, .wav, .ogg, .webm
  const audioFileName = Object.keys(content.files).find(n =>
    n.toLowerCase().endsWith('.mp3') ||
    n.toLowerCase().endsWith('.wav') ||
    n.toLowerCase().endsWith('.ogg') ||
    n.toLowerCase().endsWith('.webm')
  );

  // Load slides as blob URLs
  currentSlides = [];
  for (const sname of meta.slides) {
    const sf = content.file('slides/' + sname);
    if (!sf) continue;
    const blob = await sf.async('blob');
    currentSlides.push(URL.createObjectURL(blob));
  }
  currentTimings = meta.timings || [];
  
  if (currentSlides.length === 0) {
    $('class-meta').textContent += ' (no slides)'; 
    return;
  }

  // Show player section always, even if audio missing
  $('player').classList.remove('hidden');
  slideIdx = 0; 
  showSlide(0);

  // If audio exists, load it; else show controls for manual navigation
  if (audioFileName) {
    const audioData = await content.file(audioFileName).async('blob');
    audioEl.src = URL.createObjectURL(audioData);
    audioEl.style.display = "block";
  } else {
    $('class-meta').textContent += '  (no audio found — manual slide control only)';
    audioEl.style.display = "none";
  }

  setupControls();
});

// Show selected slide
function showSlide(i) {
  if (!currentSlides[i]) return;
  slideImg.src = currentSlides[i];
  slideIdx = i;
}

// Setup all controls including Next/Prev
function setupControls() {
  clearInterval(interval);

  $('prev-slide').onclick = () => {
    if (!currentSlides.length) return;
    const newIdx = Math.max(0, slideIdx - 1);
    showSlide(newIdx);
    if (currentTimings[newIdx] !== undefined) audioEl.currentTime = currentTimings[newIdx];
  };

  $('start').onclick = () => {
    if (audioEl.src && !audioEl.paused) {
      audioEl.pause();
      $('start').textContent = 'Start';
      clearInterval(interval);
    } else if (audioEl.src) {
      audioEl.play();
      startSync();
      $('start').textContent = 'Pause';
    }
  };

  $('reset').onclick = () => {
    if (audioEl.src) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    showSlide(0);
    $('start').textContent = 'Start';
    clearInterval(interval);
  };

  $('back-10').onclick = () => {
    if (audioEl.src) {
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 10);
      updateSlideToTime(audioEl.currentTime);
    }
  };

  $('forward-10').onclick = () => {
    if (audioEl.src) {
      audioEl.currentTime = Math.min(audioEl.duration || Infinity, audioEl.currentTime + 10);
      updateSlideToTime(audioEl.currentTime);
    }
  };

  $('next-slide').onclick = () => {
    if (!currentSlides.length) return;
    const newIdx = Math.min(currentSlides.length - 1, slideIdx + 1);
    showSlide(newIdx);
    if (currentTimings[newIdx] !== undefined) audioEl.currentTime = currentTimings[newIdx];
  };

  // Auto sync slides only if timings exist and audio is available
  if (audioEl.src && currentTimings.length > 0) {
    audioEl.ontimeupdate = () => updateSlideToTime(audioEl.currentTime);
  }
}

function startSync() {
  clearInterval(interval);
  interval = setInterval(() => {
    updateSlideToTime(audioEl.currentTime);
    if (audioEl.ended) clearInterval(interval);
  }, 250);
}

function updateSlideToTime(t) {
  let idx = 0;
  for (let i = 0; i < currentTimings.length; i++) {
    if (t >= currentTimings[i]) idx = i; else break;
  }
  if (idx !== slideIdx) showSlide(idx);
}

// Admin simple local-subject list (no DB)
const ADMIN_PASS = 'liteclass';
$('admin-login').onclick = () => {
  const p = $('admin-pass').value;
  if (p !== ADMIN_PASS) { alert('Wrong password'); return; }
  $('admin-panel').classList.remove('hidden');
  loadSubjects();
}

function loadSubjects() {
  const subs = JSON.parse(localStorage.getItem('liteclass_subjects') || '[]');
  const ul = $('subject-list'); ul.innerHTML = '';
  subs.forEach((s, idx) => {
    const li = document.createElement('li'); li.textContent = s;
    const b = document.createElement('button'); b.textContent = 'Remove';
    b.onclick = () => { subs.splice(idx, 1); localStorage.setItem('liteclass_subjects', JSON.stringify(subs)); loadSubjects(); };
    li.appendChild(b); ul.appendChild(li);
  });
}

$('add-subject').onclick = () => {
  const s = $('new-subject').value.trim();
  if (!s) return;
  const subs = JSON.parse(localStorage.getItem('liteclass_subjects') || '[]');
  subs.push(s);
  localStorage.setItem('liteclass_subjects', JSON.stringify(subs));
  $('new-subject').value = '';
  loadSubjects();
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => console.log('SW registered'));
}
