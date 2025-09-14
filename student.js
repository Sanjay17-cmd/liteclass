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
async function loadStudentClasses() {
  const list = document.getElementById("student-class-list");
  if (!list) return;

  list.innerHTML = "";
  const user = JSON.parse(localStorage.getItem("remoteclass_user"));
  const { data, error } = await db.getClasses("student", user.id);

  if (error) {
    list.innerHTML = `<li>❌ Error: ${error.message}</li>`;
    return;
  }

  (data || []).forEach(c => {
    const li = document.createElement("li");
    li.textContent = `${c.subject} (by teacher ${c.teacher_id})`;

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View Lectures";
    viewBtn.onclick = async () => {
      const { data: lectures } = await db.getLectures(c.id);
      if (!lectures || lectures.length === 0) {
        alert("No lectures yet for this class");
        return;
      }
      // 👉 Show first lecture (later: let student choose)
      const lec = lectures[0];
      const { data: blob } = await storage.downloadAsBlob(lec.storage_path);
      loadZip(blob); // reuse offline player
    };

    li.appendChild(viewBtn);
    list.appendChild(li);
  });
}

// Run on page load (online mode)
if (document.getElementById("student-class-list")) {
  loadStudentClasses();
}

async function loadStudentAssignments() {
  const list = document.getElementById("student-assignment-list");
  list.innerHTML = "";

  const { data, error } = await assignments.listForClass(null); // later link with real classId
  if (error) {
    list.innerHTML = `<li>❌ Error: ${error.message}</li>`;
    return;
  }

  (data || []).forEach(a => {
    const li = document.createElement("li");
    li.textContent = `${a.title} (Due: ${a.due_date})`;

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";
    submitBtn.onclick = () => {
      const ans = prompt("Enter your answer / upload link:");
      if (ans) alert("✅ Answer submitted (placeholder)"); 
      // TODO: create `submissions` table in DB
    };

    li.appendChild(submitBtn);
    list.appendChild(li);
  });
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
  const list = document.getElementById("teacher-upload-list");
  if (!list) return;
  list.innerHTML = "";

  const CLASS_ID = "300dd5d3-058c-488f-90f8-ee02ce879531"; // 👈 same UUID as above

  const { data, error } = await window.supabaseHelpers.client
    .from("lectures")
    .select("*")
    .eq("class_id", CLASS_ID);

  if (error) {
    list.innerHTML = `<li>❌ Error: ${error.message}</li>`;
    return;
  }

  (data || []).forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.storage_path}`;

    // Cache download
    const cacheBtn = document.createElement("button");
    cacheBtn.textContent = "Save to Cache";
    cacheBtn.onclick = async () => {
      const blob = await storage.downloadAsBlob(item.storage_path);
      const base64 = await blobToDataURL(blob);
      localStorage.setItem(item.storage_path, base64);
      alert("✅ Saved to cache: " + item.storage_path);

      if (item.storage_path.startsWith("live_") || item.storage_path.includes("recorded_live")) {
        localStorage.setItem("defaultStudentTab", "classes");
        window.location.href = "student-live.html";
      }
    };

    // Device download
    const deviceBtn = document.createElement("button");
    deviceBtn.textContent = "Download to Device";
    deviceBtn.onclick = async () => {
      const blob = await storage.downloadAsBlob(item.storage_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.storage_path.split("/").pop();
      a.click();
      URL.revokeObjectURL(url);
    };

    li.appendChild(cacheBtn);
    li.appendChild(deviceBtn);
    list.appendChild(li);
  });
}



// Convert Blob → Base64 DataURL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
