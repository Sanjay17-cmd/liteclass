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
if (document.getElementById("start-btn")) {

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
const resetBtn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
  audioEl.pause();
  audioEl.currentTime = 0;
  currentSlide = 0;
  renderSlide();
  isPlaying = false;
  document.getElementById("start-btn").textContent = "Start";
});
}

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

}

// Sync slides with timeline while playing
if (audioEl) {
audioEl.addEventListener("timeupdate", () => {
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (audioEl.currentTime >= timeline[i].time) {
      currentSlide = timeline[i].slide;
      renderSlide();
      break;
    }
  }
});
}

// -----------------------------
// Load from cache or file
// -----------------------------

// -----------------------------
// Toggle saved classes from cache
// -----------------------------
let cacheVisible = false;

const showCacheBtn = document.getElementById("show-cache");
if (showCacheBtn) {
  showCacheBtn.addEventListener("click", () => {
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
}

const loadZipInput = document.getElementById("load-zip");
if (loadZipInput) {
  loadZipInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      loadZip(file);
    }
  });
}


// -----------------------------
// ONLINE MODE HELPERS
// -----------------------------
const { db, storage, assignments, quizzes, polls } = window.supabaseHelpers;

// Load classes for student
let isLoadingAssignments = false; // prevent duplicate loads

async function loadStudentAssignments() {
  if (isLoadingAssignments) return; // stop duplicate calls
  isLoadingAssignments = true;

  const list = document.getElementById("student-assignment-list");
  if (!list) return;
  list.innerHTML = "<li>⏳ Loading assignments...</li>";

  const user = JSON.parse(localStorage.getItem("remoteclass_user"));

  // Fetch all assignments
  const { data: assignmentsData, error } = await assignments.listAll();
  if (error) {
    list.innerHTML = `<li>❌ Error loading assignments: ${error.message}</li>`;
    isLoadingAssignments = false;
    return;
  }

  // Fetch student's submissions
  const { data: submissions } = await supabaseHelpers.client
    .from("submissions")
    .select("*")
    .eq("student_id", user.id);

  const mySubs = submissions || [];

  // Split into posted & completed
  const posted = [];
  const completed = [];

  (assignmentsData || []).forEach(a => {
    const sub = mySubs.find(s => s.assignment_id === a.id);
    if (sub) {
      completed.push({ a, sub });
    } else {
      posted.push(a);
    }
  });

  list.innerHTML = ""; // clear after data ready

  // ---------------- 📌 Posted Assignments ----------------
  if (posted.length > 0) {
    const postedHeader = document.createElement("h4");
    postedHeader.textContent = "📌 Posted Assignments";
    list.appendChild(postedHeader);

    posted.forEach(a => {
      const div = document.createElement("div");
      div.classList.add("assignment-card");

      // fallback title if missing
      const title = a.title || a.instructions?.slice(0, 30) || "Untitled Assignment";

      div.innerHTML = `
        <strong>${title}</strong> (${a.subject || "No subject"})<br>
        ${a.instructions || "No instructions"}<br>
        Due: ${a.due_date || "No due date"}<br>
      `;

      // Answer textarea
      const textInput = document.createElement("textarea");
      textInput.placeholder = "Write your answer here...";

      // File upload
      const fileInput = document.createElement("input");
      fileInput.type = "file";

      // Submit button
      const submitBtn = document.createElement("button");
      submitBtn.textContent = "Upload & Submit";
      submitBtn.onclick = async () => {
        const file = fileInput.files[0];
        let filePath = null;
        if (file) {
          filePath = `submissions/${user.username}_${a.id}_${file.name}`;
          await window.supabaseHelpers.client
  .storage.from("submissions")
  .upload(filePath, file, { upsert: true });
        }

     const { data, error } = await supabaseHelpers.submissions.create({
  assignment_id: a.id,
  student_id: user.id,
  answer_text: textInput.value,
  file_path: filePath,
  status: "submitted"
});

if (error) {
  console.error("❌ Submission insert error:", error);
  alert("Submission failed: " + error.message);
}


        alert("✅ Submitted!");
        loadStudentAssignments(); // refresh after submit
      };

      div.appendChild(textInput);
      div.appendChild(fileInput);
      div.appendChild(submitBtn);

      list.appendChild(div);
    });
  }

  // ---------------- ✅ Completed Assignments ----------------
  if (completed.length > 0) {
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Show Completed Assignments";
    let showing = false;

    const container = document.createElement("div");
    container.style.display = "none";

    toggleBtn.onclick = () => {
      showing = !showing;
      container.style.display = showing ? "block" : "none";
      toggleBtn.textContent = showing
        ? "Hide Completed Assignments"
        : "Show Completed Assignments";
    };

    list.appendChild(toggleBtn);
    list.appendChild(container);

    completed.forEach(({ a, sub }) => {
      const div = document.createElement("div");
      div.classList.add("assignment-card");

      const title = a.title || a.instructions?.slice(0, 30) || "Untitled Assignment";

      div.innerHTML = `
        <strong>${title}</strong> (${a.subject || "No subject"})<br>
        ${a.instructions || "No instructions"}<br>
        ✅ Submitted on ${new Date(sub.created_at).toLocaleString()}<br>
        📄 File: ${sub.file_path ? `<a href="${sub.file_path}" target="_blank">Download</a>` : "None"}<br>
        📝 Answer: ${sub.answer_text || "N/A"}<br>
        🎯 Marks: ${sub.marks !== null ? sub.marks : "Pending"}
      `;

      container.appendChild(div);
    });
  }

  isLoadingAssignments = false; // release lock
}


let quizzesLoading = false;
async function loadStudentQuizzes() {
  if (quizzesLoading) return;   // ✅ ignore if already loading
  quizzesLoading = true;

  const list = document.getElementById("student-quiz-list");
  if (!list) return;
  list.innerHTML = "";

   try {
  const user = JSON.parse(localStorage.getItem("remoteclass_user"));

  // ✅ fetch all quizzes
  const { data: quizzesData, error } = await quizzes.listForLecture(null); 
  if (error) {
    list.innerHTML = `<li>❌ Error: ${error.message}</li>`;
    return;
  }

  // ✅ fetch student's answers
  const { data: myAnswers, error: ansError } =
    await window.supabaseHelpers.quizResponses.listForStudent(user.id);
  const answers = myAnswers || [];

  list.innerHTML = "";

  // Split quizzes
  const answeredQuizzes = [];
  const notAnsweredQuizzes = [];

  (quizzesData || []).forEach(q => {
    const myAns = answers.find(a => a.quiz_id === q.id);
    if (myAns) {
      answeredQuizzes.push({ quiz: q, answer: myAns });
    } else {
      notAnsweredQuizzes.push(q);
    }
  });

  // ---- Not Answered ----
  if (notAnsweredQuizzes.length > 0) {
    const header = document.createElement("h4");
    header.textContent = "Not Answered Quizzes";
    list.appendChild(header);

    notAnsweredQuizzes.forEach(q => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>[${q.subject}] ${q.question}</strong><br>`;

      q.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.onclick = async () => {
          const correct = q.correct.includes(opt);
          await window.supabaseHelpers.quizResponses.answer(q.id, user.id, opt, correct);
          loadStudentQuizzes();
        };
        li.appendChild(btn);
      });

      list.appendChild(li);
    });
  }

  // ---- Answered ----
  if (answeredQuizzes.length > 0) {
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Show Answered Quizzes";
    let showing = false;

    const answeredContainer = document.createElement("div");
    answeredContainer.style.display = "none";

    toggleBtn.onclick = () => {
      showing = !showing;
      answeredContainer.style.display = showing ? "block" : "none";
      toggleBtn.textContent = showing ? "Hide Answered Quizzes" : "Show Answered Quizzes";
    };

    list.appendChild(toggleBtn);
    list.appendChild(answeredContainer);

    // Group by subject
    const bySubject = {};
    answeredQuizzes.forEach(({ quiz, answer }) => {
      if (!bySubject[quiz.subject]) bySubject[quiz.subject] = [];
      bySubject[quiz.subject].push({ quiz, answer });
    });

    Object.keys(bySubject).forEach(subject => {
      const subjBlock = document.createElement("div");
      subjBlock.innerHTML = `<h4>📘 ${subject}</h4>`;

      let correctCount = 0;

      bySubject[subject].forEach(({ quiz, answer }) => {
        const isCorrect = answer.is_correct;
        if (isCorrect) correctCount++;

        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${quiz.question}</strong><br>
          ✅ Correct Answer(s): ${quiz.correct.join(", ")}<br>
          📝 Your Answer: ${answer.option} ${isCorrect ? "✔️" : "❌"}
        `;
        subjBlock.appendChild(li);
      });

      // Subject total marks
      subjBlock.innerHTML += `<p><strong>Total: ${correctCount}/${bySubject[subject].length}</strong></p>`;
      answeredContainer.appendChild(subjBlock);
    });
  }
    } finally {
    quizzesLoading = false;
  }
}

let pollsLoading = false;
async function loadStudentPolls() {
  if (pollsLoading) return;
  pollsLoading = true;

  const list = document.getElementById("student-poll-list");
  if (!list) return;
  list.innerHTML = "";

  try {
  const user = JSON.parse(localStorage.getItem("remoteclass_user"));
  const { data: pollsData, error: pollError } = await polls.listAll();
  if (pollError) {
    list.innerHTML = `<li>❌ Error loading polls: ${pollError.message}</li>`;
    return;
  }

  const { data: myVotes, error: voteError } = 
    await window.supabaseHelpers.pollResponses.listForStudent(user.id);

  const safeVotes = myVotes || [];

  const votedPolls = [];
  const notVotedPolls = [];

  (pollsData || []).forEach(p => {
    const myVote = safeVotes.find(v => v.poll_id === p.id);
    if (myVote) {
      votedPolls.push({ poll: p, choice: myVote.option });
    } else {
      notVotedPolls.push(p);
    }
  });

  // ✅ Nothing at all
  if (pollsData.length === 0) {
    list.innerHTML = "<li>No polls available yet.</li>";
    return;
  }

  // ---- Not Voted Polls ----
  if (notVotedPolls.length > 0) {
    const header = document.createElement("h4");
    header.textContent = "Not Voted Polls";
    list.appendChild(header);

    notVotedPolls.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${p.question}</strong><br>`;

      p.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.onclick = async () => {
          await window.supabaseHelpers.pollResponses.vote(p.id, user.id, opt);
          loadStudentPolls();
        };
        li.appendChild(btn);
      });

      list.appendChild(li);
    });
  }

// ---- Toggle for Voted Polls ----
if (votedPolls.length > 0) {
  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "Show Voted Polls";
  let showing = false;

  const votedContainer = document.createElement("div");
  votedContainer.style.display = "none";

  toggleBtn.onclick = () => {
    showing = !showing;
    votedContainer.style.display = showing ? "block" : "none";
    toggleBtn.textContent = showing ? "Hide Voted Polls" : "Show Voted Polls";
  };

  list.appendChild(toggleBtn);
  list.appendChild(votedContainer);

  votedPolls.forEach(({ poll, choice }) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${poll.question}</strong><br>(You voted: ${choice})<br>`;

    poll.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = opt + (opt === choice ? " ✅" : "");
      btn.onclick = async () => {
        await window.supabaseHelpers.pollResponses.vote(poll.id, user.id, opt);
        loadStudentPolls();
      };
      li.appendChild(btn);
    });

    votedContainer.appendChild(li);
  });
}
  } finally {
    pollsLoading = false;
  }
}



if (document.getElementById("student-assignment-list")) loadStudentAssignments();
if (document.getElementById("student-quiz-list")) loadStudentQuizzes();
if (document.getElementById("student-poll-list")) loadStudentPolls();

// -----------------------------
// DOWNLOAD & UPLOAD QUEUE
// -----------------------------
async function loadTeacherUploads() {
  // List all files in the bucket/folder
const { data: files, error } = await window.supabaseHelpers.client
  .storage.from("lectures")
  .list("", { limit: 100, offset: 0 }); // list from root

  if (error) {
    console.error("Error loading files:", error);
    return;
  }

  // Filter out cached files
const downloadedKeys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));
const available = (files || []).filter(file => !downloadedKeys.includes(file.name));

  // Update UI with available files
  const list = document.getElementById("teacher-upload-list"); // <-- FIXED ID
  list.innerHTML = "";
  if (available.length === 0) {
    list.innerHTML = "<li>No available uploads</li>";
    return;
  }
  available.forEach(file => {
  const li = document.createElement("li");
  li.textContent = file.name + " ";

  const cacheBtn = document.createElement("button");
  cacheBtn.textContent = "Save to Cache";
  cacheBtn.style.marginLeft = "10px";
  cacheBtn.onclick = () => saveToCache(file.name);

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download";
  downloadBtn.style.marginLeft = "5px";
  downloadBtn.onclick = () => downloadFile(file.name);

  li.appendChild(cacheBtn);
  li.appendChild(downloadBtn);
  list.appendChild(li);
});

}

// Call this function when you want to refresh the uploads list
// e.g., on page load or when switching tabs
loadTeacherUploads();

// Convert Blob → Base64 DataURL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Save a file to localStorage
async function saveToCache(fileName) {
  const { data, error } = await window.supabaseHelpers.client
    .storage.from("lectures")
    .download(fileName);

  if (error) {
    console.error("Error downloading file:", error.message);
    return;
  }

  const blob = data;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(fileName, reader.result);
    alert(`${fileName} cached successfully`);
    loadTeacherUploads(); // refresh lists
  };
  reader.readAsDataURL(blob);
}

// Download file directly
async function downloadFile(fileName) {
  const { data, error } = await window.supabaseHelpers.client
    .storage.from("lectures")
    .download(fileName);

  if (error) {
    console.error("Error downloading:", error.message);
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// Assignment Uploads
async function loadAssignmentUploads() {
  const list = document.getElementById("assignment-upload-list");
  if (!list) return;
  list.innerHTML = "";

  const { data, error } = await assignments.listForClass(null);
  if (error) {
    list.innerHTML = `<li>❌ Error: ${error.message}</li>`;
    return;
  }

  const user = JSON.parse(localStorage.getItem("remoteclass_user"));

  (data || []).forEach(a => {
    const li = document.createElement("li");
    li.textContent = `${a.title} (Due: ${a.due_date})`;

    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload Answer";
    uploadBtn.onclick = async () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const path = `assignments/${user.username}_${a.id}_${file.name}`;
        await storage.uploadLecture(file, path);

        await supabaseHelpers.client.from("submissions").insert({
          assignment_id: a.id,
          student_id: user.id,
          file_path: path
        });

        alert("✅ Assignment uploaded!");
      };
      fileInput.click();
    };

    li.appendChild(uploadBtn);
    list.appendChild(li);
  });
}

// Toggle downloaded files list
const toggleBtn = document.getElementById("toggle-downloaded");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const list = document.getElementById("downloaded-files");
    if (list.classList.contains("hidden")) {
      list.innerHTML = "";
      const keys = Object.keys(localStorage).filter(k => k.endsWith(".zip"));
      if (keys.length === 0) {
        list.innerHTML = "<li>No downloaded files</li>";
      } else {
        keys.forEach(k => {
          const li = document.createElement("li");
          li.textContent = k;
          const playBtn = document.createElement("button");
  playBtn.textContent = "Play";
  playBtn.style.marginLeft = "10px";
  playBtn.onclick = () => {
    const base64Data = localStorage.getItem(k);
    fetch(base64Data).then(res => res.blob()).then(blob => loadZip(blob));
    document.querySelector("[data-tab='prerecorded']").click();
  };

  li.appendChild(playBtn);
          list.appendChild(li);
        });
      }
      list.classList.remove("hidden");
      toggleBtn.textContent = "Hide Downloaded Files";
    } else {
      list.classList.add("hidden");
      toggleBtn.textContent = "Show Downloaded Files";
    }
  });
}

// Load when tab opened
document.querySelector("[data-tab='queue']").addEventListener("click", () => {
  loadTeacherUploads();
  loadAssignmentUploads();
});
