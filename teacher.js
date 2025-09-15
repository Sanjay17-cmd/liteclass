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
// Show saved recorder classes
// -----------------------------
document.getElementById("rec-list")?.addEventListener("click", () => {
  const list = document.getElementById("rec-saved-list");
  list.innerHTML = "";

  const keys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));
  if (keys.length === 0) {
    list.innerHTML = "<li>No saved recorder classes</li>";
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
    document.getElementById("rec-status").textContent = "Recording paused.";
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

// -----------------------------
// Common function to refresh Upload/Download Queue
// -----------------------------
function refreshQueue() {
  const queue = document.getElementById("queue-list");
  if (!queue) return;

  queue.innerHTML = "";
  const keys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));

  if (keys.length === 0) {
    queue.innerHTML = "<li>No pending files</li>";
    return;
  }

  keys.forEach(key => {
    const li = document.createElement("li");
    li.textContent = key + " ";

    // Upload button
    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload";
    uploadBtn.onclick = async () => {
      try {
        const dataUrl = localStorage.getItem(key);
        const blob = await (await fetch(dataUrl)).blob();

        // ✅ Upload to 'lectures' bucket using helper
        const { data, error } = await window.supabaseHelpers.storage.uploadLecture(blob, key);

        if (error) {
          alert("❌ Upload failed: " + error.message);
        } else {
          alert("✅ Uploaded: " + key);
          localStorage.removeItem(key);
          refreshQueue();
        }
      } catch (err) {
        console.error(err);
        alert("❌ Unexpected error during upload");
      }
    };

    li.appendChild(uploadBtn);
    queue.appendChild(li);
  });
}

// -----------------------------
// Hook into Recorder + Pre-recorded save buttons
// -----------------------------
document.getElementById("rec-save")?.addEventListener("click", () => {
  setTimeout(refreshQueue, 500);
});
document.getElementById("pre-save")?.addEventListener("click", () => {
  setTimeout(refreshQueue, 500);
});
document.getElementById("rec-list")?.addEventListener("click", refreshQueue);
document.getElementById("pre-list")?.addEventListener("click", refreshQueue);

// Run once on load
refreshQueue();

// -----------------------------
// Assignments
// -----------------------------
// -----------------------------
// Assignments
// -----------------------------
const { assignments } = window.supabaseHelpers;

document.getElementById("create-assignment")?.addEventListener("click", async () => {
  const subject = document.getElementById("ass-subject").value.trim();
  const instructions = document.getElementById("ass-instructions").value.trim();
  const fileInput = document.getElementById("ass-file");
  const file = fileInput.files[0];

  if (!subject || !instructions || !file) {
    alert("⚠️ Please fill all fields and select a file");
    return;
  }

  const user = JSON.parse(localStorage.getItem("remoteclass_user"));
  const fileName = "ass_" + Date.now() + "_" + file.name;

  // 1. Upload file to storage
  const { error: uploadError } = await window.supabaseHelpers.client
    .storage.from("assignments")
    .upload(fileName, file);

  if (uploadError) {
    alert("❌ Upload failed: " + uploadError.message);
    return;
  }

  // 2. Save record in DB
  const { error } = await assignments.create({
    teacher_id: user.id,
    subject,
    instructions,
    file_path: fileName
  });

  if (error) {
    alert("❌ Assignment error: " + error.message);
  } else {
    alert("✅ Assignment posted!");
    document.getElementById("ass-subject").value = "";
    document.getElementById("ass-instructions").value = "";
    fileInput.value = "";
    loadAssignments();
  }
});

async function loadAssignments() {
  const list = document.getElementById("assignment-list");
  if (!list) return;
  list.innerHTML = "";

  const { data, error } = await assignments.listAll();
  if (error) {
    console.error("Assignments load error:", error);
    return;
  }

  const grouped = {};
  (data || []).forEach(a => {
    if (!grouped[a.subject]) grouped[a.subject] = [];
    grouped[a.subject].push(a);
  });

  for (const subject of Object.keys(grouped)) {
    const container = document.createElement("div");
    container.classList.add("assignment-group");

    const header = document.createElement("h3");
    header.innerHTML = `
      ${subject}
      <button onclick="toggleAssignments('${subject}-list')">Show/Hide</button>
    `;
    container.appendChild(header);

    const ul = document.createElement("ul");
    ul.id = `${subject}-list`;
    ul.style.display = "none";

    for (const a of grouped[subject]) {
      const li = document.createElement("li");
      li.innerHTML = `
        <b>${a.instructions}</b>
        <br>
        <button onclick="downloadAssignmentFile('${a.file_path}')">Download</button>
        <div id="submissions-${a.id}">Loading submissions...</div>
      `;
      ul.appendChild(li);

      // fetch submissions for this assignment
      loadSubmissions(a.id);
    }

    container.appendChild(ul);
    list.appendChild(container);
  }
}

async function loadSubmissions(assignmentId) {
  const target = document.getElementById(`submissions-${assignmentId}`);
  if (!target) return;

  const { data, error } = await window.supabaseHelpers.submissions.listForAssignment(assignmentId);

  if (error) {
  console.error("❌ Submissions load error:", error);
  target.textContent = "Failed to load submissions";
  return;
}

  if (!data || data.length === 0) {
    target.textContent = "No submissions yet.";
    return;
  }

  target.innerHTML = "";
  data.forEach(s => {
    const div = document.createElement("div");
    div.innerHTML = `
      👤 Student ID: ${s.student_id}<br>
      📝 Answer: ${s.answer || "(no text)"}<br>
      ${s.file_path ? `<a href="#" onclick="downloadSubmissionFile('${s.file_path}')">📄 Download File</a><br>` : ""}
      🎯 Marks: <input type="number" id="marks-${s.id}" value="${s.marks ?? ""}" style="width:60px">
      <button onclick="saveMarks(${s.id})">Save</button>
      <hr>
    `;
    target.appendChild(div);
  });
}

async function downloadSubmissionFile(filePath) {
  const { data, error } = await window.supabaseHelpers.client
    .storage.from("submissions")
    .download(filePath);

  if (error) {
    alert("❌ Download failed: " + error.message);
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filePath;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveMarks(submissionId) {
  const marks = document.getElementById(`marks-${submissionId}`).value;
  const { error } = await window.supabaseHelpers.client
    .from("submissions")
    .update({ marks: parseInt(marks) })
    .eq("id", submissionId);

  if (error) {
    alert("❌ Failed to save marks: " + error.message);
  } else {
    alert("✅ Marks saved!");
  }
}


// Toggle function
function toggleAssignments(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = (el.style.display === "none") ? "block" : "none";
  }
}

// Auto-load assignments on page load
window.addEventListener("DOMContentLoaded", () => {
  loadAssignments();
});


function toggleAssignments(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = (el.style.display === "none") ? "block" : "none";
  }
}

async function downloadAssignmentFile(filePath) {
  const { data, error } = await window.supabaseHelpers.client
    .storage.from("assignments")
    .download(filePath);

  if (error) {
    alert("❌ Download failed: " + error.message);
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filePath;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// -----------------------------
// Quizzes (use the new form you made)
// -----------------------------
// (paste the quiz block I gave earlier with subject, questions, options, correct answers)
const { quizzes } = window.supabaseHelpers;

let quizQuestions = []; // temporary store before saving

// Helper: Render a question block
function createQuestionBlock(qIndex) {
  const wrapper = document.createElement("div");
  wrapper.className = "quiz-question-block";
  wrapper.innerHTML = `
    <label>Question ${qIndex + 1}:</label>
    <input type="text" class="quiz-question" placeholder="Enter question">

    <div class="quiz-options"></div>
    <button type="button" class="add-option">+ Add Option</button>
  `;

  // Handle "Add Option"
  wrapper.querySelector(".add-option").onclick = () => {
    const optDiv = wrapper.querySelector(".quiz-options");
    const optIndex = optDiv.children.length;
    const optionWrapper = document.createElement("div");
    optionWrapper.innerHTML = `
      <input type="text" class="quiz-option" placeholder="Option ${optIndex + 1}">
      <input type="checkbox" class="quiz-correct"> Correct
    `;
    optDiv.appendChild(optionWrapper);
  };

  return wrapper;
}

// Add new question
document.getElementById("add-question").onclick = () => {
  const container = document.getElementById("quiz-questions-container");
  const qBlock = createQuestionBlock(container.children.length);
  container.appendChild(qBlock);
};

// Save Quiz
document.getElementById("save-quiz").onclick = async () => {
  const subject = document.getElementById("quiz-subject").value.trim();
  if (!subject) {
    alert("⚠️ Enter subject name!");
    return;
  }

  const qBlocks = document.querySelectorAll(".quiz-question-block");
  if (qBlocks.length === 0) {
    alert("⚠️ Add at least one question!");
    return;
  }

  const user = JSON.parse(localStorage.getItem("remoteclass_user"));

  quizQuestions = [];
  qBlocks.forEach(block => {
    const question = block.querySelector(".quiz-question").value.trim();
    const optionEls = block.querySelectorAll(".quiz-option");
    const correctEls = block.querySelectorAll(".quiz-correct");

    const options = [];
    const correct = [];
    optionEls.forEach((opt, idx) => {
      if (opt.value.trim()) {
        options.push(opt.value.trim());
        if (correctEls[idx].checked) correct.push(opt.value.trim());
      }
    });

    if (question && options.length >= 2) {
      quizQuestions.push({ subject, question, options, correct, lecture_id: null });
    }
  });

  if (quizQuestions.length === 0) {
    alert("⚠️ Enter valid questions with at least 2 options.");
    return;
  }

  // Upload all questions
  for (let q of quizQuestions) {
    const { error } = await quizzes.create(q);
    if (error) {
      console.error("Quiz error:", error);
      alert("❌ Error: " + error.message);
      return;
    }
  }

  alert("✅ Quiz saved!");
  document.getElementById("quiz-questions-container").innerHTML = "";
  quizQuestions = [];
  loadQuizzes();
};

// Load quizzes from DB
async function loadQuizzes() {
  const list = document.getElementById("quiz-list");
  list.innerHTML = "";

  const { data, error } = await quizzes.listForLecture(null); // later: link to class/lecture
  if (error) {
    console.error(error);
    return;
  }

  // Latest to oldest
  (data || []).sort((a, b) => b.id - a.id).forEach(q => {
    const li = document.createElement("li");
    li.textContent = `[${q.subject}] ${q.question} → Options: ${q.options.join(", ")} | Correct: ${q.correct.join(", ")}`;
    list.appendChild(li);
  });
}

// Toggle Show/Hide Quizzes
const btnShowQuizzes = document.getElementById("refresh-quizzes");
if (btnShowQuizzes) {
  btnShowQuizzes.addEventListener("click", async () => {
    const list = document.getElementById("quiz-list");

    if (list.style.display === "none" || list.innerHTML === "") {
      // 👉 Show quizzes
      await loadQuizzes();
      list.style.display = "block";
      btnShowQuizzes.textContent = "Hide Previous Quizzes";
    } else {
      // 👉 Hide quizzes
      list.innerHTML = "";
      list.style.display = "none";
      btnShowQuizzes.textContent = "Show Previous Quizzes";
    }
  });
}

// Load quizzes function
async function loadQuizzes() {
  const list = document.getElementById("quiz-list");
  list.innerHTML = "";

  const { data, error } = await quizzes.listForLecture(null);
  if (error) {
    console.error(error);
    return;
  }

  // Order latest → oldest
  (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach(q => {
      const li = document.createElement("li");
      li.textContent = `[${q.subject}] ${q.question} → Options: ${q.options.join(", ")} | Correct: ${q.correct.join(", ")}`;
      list.appendChild(li);
    });
}

// Load once on page load
loadQuizzes();
// ------------------------------
// Polls Management
// -----------------------------
// -----------------------------
// POLLS (Teacher) - show/hide + counts per option
// Replace existing Polls block with this
// -----------------------------
const { polls } = window.supabaseHelpers;

// Add option (UI)
document.getElementById("add-option")?.addEventListener("click", () => {
  const container = document.getElementById("poll-options");
  if (!container) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "poll-option";
  input.placeholder = `Option ${container.querySelectorAll('.poll-option').length + 1}`;
  container.appendChild(input);
});

// Create poll (store empty responses array by default)
document.getElementById("create-poll")?.addEventListener("click", async () => {
  const questionEl = document.getElementById("poll-question");
  const question = questionEl?.value?.trim() || "";
  const options = Array.from(document.querySelectorAll(".poll-option"))
    .map(o => o.value.trim())
    .filter(v => v);

  if (!question || options.length < 2) {
    alert("⚠️ Enter poll question + at least 2 options");
    return;
  }

  // Save with an initial empty responses array (safe default)
  const { data, error } = await polls.create({
    lecture_id: null,
    question,
    options,
    responses: [] // store as JSON array of votes (flexible format)
  });

  if (error) {
    alert("❌ Poll error: " + error.message);
    console.error("poll create error:", error);
  } else {
    // clear UI
    questionEl.value = "";
    document.getElementById("poll-options").innerHTML = `
      <input type="text" class="poll-option" placeholder="Option 1">
      <input type="text" class="poll-option" placeholder="Option 2">`;
    // refresh list if visible
    await loadPolls();
  }
});

// Compute counts for options — handles several response shapes
function computePollCounts(poll) {
  const options = poll.options || [];
  const counts = new Array(options.length).fill(0);
  let resp = poll.responses;

  if (!resp) return counts;

  try {
    if (typeof resp === "string") {
      resp = JSON.parse(resp);
    }
  } catch (e) {
    console.error("Could not parse poll.responses for poll", poll.id, e);
    resp = null;
  }
  if (!resp) return counts;

  // If responses stored as array (most flexible)
  if (Array.isArray(resp)) {
    resp.forEach(entry => {
      if (typeof entry === "number") {
        if (entry >= 0 && entry < counts.length) counts[entry]++;
      } else if (typeof entry === "string") {
        const num = Number(entry);
        if (!isNaN(num) && num >= 0 && num < counts.length) counts[num]++;
        else {
          const idx = options.indexOf(entry);
          if (idx >= 0) counts[idx]++;
        }
      } else if (typeof entry === "object") {
        if ("optionIndex" in entry && typeof entry.optionIndex === "number") {
          const i = entry.optionIndex; if (i >= 0 && i < counts.length) counts[i]++;
        } else if ("option" in entry) {
          const idx = options.indexOf(entry.option);
          if (idx >= 0) counts[idx]++;
        }
      }
    });
    return counts;
  }

  // If responses stored as object (option->array or option->count)
  if (typeof resp === "object") {
    Object.entries(resp).forEach(([k, v]) => {
      const idx = isNaN(Number(k)) ? options.indexOf(k) : Number(k);
      if (Array.isArray(v)) {
        if (idx >= 0) counts[idx] = v.length;
        else {
          const idx2 = options.indexOf(k);
          if (idx2 >= 0) counts[idx2] = v.length;
        }
      } else if (typeof v === "number") {
        if (idx >= 0) counts[idx] = v;
        else {
          const idx2 = options.indexOf(k);
          if (idx2 >= 0) counts[idx2] = v;
        }
      }
    });
    return counts;
  }

  return counts;
}

// Toggle Show/Hide polls button behavior
const btnShowPolls = document.getElementById("refresh-polls");
btnShowPolls?.addEventListener("click", async () => {
  const list = document.getElementById("poll-list");
  if (!list) return;

  const isHidden = list.style.display === "none" || list.innerHTML.trim() === "";
  if (isHidden) {
    await loadPolls();
    list.style.display = "block";
    btnShowPolls.textContent = "Hide Previous Polls";
  } else {
    list.innerHTML = "";
    list.style.display = "none";
    btnShowPolls.textContent = "Show Previous Polls";
  }
});

// Load + render polls (latest → oldest)
async function loadPolls() {
  const list = document.getElementById("poll-list");
  if (!list) return;
  list.innerHTML = "";

  const { data: pollsData, error } = await polls.listAll();
  if (error) {
    console.error("Polls load error:", error);
    list.innerHTML = "<li>Failed to load polls</li>";
    return;
  }

  // Sort latest → oldest
  const rows = (pollsData || []).sort((a, b) => {
    const ta = new Date(a.created_at || a.id);
    const tb = new Date(b.created_at || b.id);
    return tb - ta;
  });

  if (rows.length === 0) {
    list.innerHTML = "<li>No polls yet</li>";
    return;
  }

  for (const p of rows) {
    // Fetch all responses for this poll
    const { data: responses, error: respError } = await window.supabaseHelpers.pollResponses.listForPoll(p.id);
    if (respError) {
      console.error("Error loading poll responses for poll", p.id, respError);
    }

    // Count votes per option
    const options = p.options || [];
    const counts = new Array(options.length).fill(0);

    (responses || []).forEach(r => {
      // r.option is the voted option (string)
      const idx = options.indexOf(r.option);
      if (idx >= 0) counts[idx]++;
    });

    const li = document.createElement("li");

    const q = document.createElement("div");
    q.textContent = p.question;
    q.style.fontWeight = "600";
    li.appendChild(q);

    const opts = document.createElement("ul");
    options.forEach((opt, idx) => {
      const oli = document.createElement("li");
      oli.textContent = `${opt} — ${counts[idx]} vote${counts[idx] !== 1 ? "s" : ""}`;
      opts.appendChild(oli);
    });
    li.appendChild(opts);

    list.appendChild(li);
  }
}

// Start hidden by default
const pollListEl = document.getElementById("poll-list");
if (pollListEl) pollListEl.style.display = "none";

// Run once on page load
loadPolls();



