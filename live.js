let pc;             // RTCPeerConnection
let localStream;    // teacher audio/video
let remoteStream;   // student receives
let channel;        // supabase realtime channel

if (!window.supabaseHelpers || !window.supabaseHelpers.rtc) {
  console.error("❌ Supabase helpers not loaded. Make sure supabase.js is included before live.js");
}

// ✅ Teacher start live
let mediaRecorder;
let recordedChunks = [];
async function startTeacherLive(classId) {
  channel = window.supabaseHelpers.rtc.joinChannel(`live-${classId}`, {
    onSignal: async (data) => {
      if (data.type === 'offer') {
        // Ignore, teacher only answers
        return;
      }
      if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (data.type === 'candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding candidate', e);
        }
      }
    }
  });

  // Create PeerConnection
  pc = new RTCPeerConnection();

  // Capture teacher media
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Teacher doesn’t need remote video, but can attach if wanted
  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
  };

  // Handle ICE
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      window.supabaseHelpers.rtc.sendSignal(channel, { type: 'candidate', candidate: event.candidate });
    }
  };

  // Teacher creates offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  window.supabaseHelpers.rtc.sendSignal(channel, { type: 'offer', offer });

    mediaRecorder = new MediaRecorder(localStream, { mimeType: "video/webm; codecs=vp9" });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.start();
}

async function stopTeacherLive() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });

    // package into zip with slides + timeline
    const zip = new JSZip();
    zip.file("recording.webm", blob);
    // TODO: keep a slideTimeline array to record when teacher changed slides
    // zip.file("timeline.json", JSON.stringify(slideTimeline));

    const content = await zip.generateAsync({ type: "blob" });
    const path = `recorded_live_math101_${Date.now()}.zip`;

    await window.supabaseHelpers.storage.uploadLecture(content, path);
    await window.supabaseHelpers.db.createLecture({
      class_id: 1,  // TODO: real class id
      storage_path: path,
      is_live_recorded: true
    });

    alert("Live class recorded & uploaded ✅");
  };
}


// ✅ Student join live
async function joinStudentLive(classId, videoEl) {
  channel = window.supabaseHelpers.rtc.joinChannel(`live-${classId}`, {
    onSignal: async (data) => {
      if (data.type === "slide") handleSlideSync(data);
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        window.supabaseHelpers.rtc.sendSignal(channel, { type: 'answer', answer });
      }
      if (data.type === 'candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding candidate', e);
        }
      }
    }
  });

  pc = new RTCPeerConnection();

  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      window.supabaseHelpers.rtc.sendSignal(channel, { type: 'candidate', candidate: event.candidate });
    }
  };

  // Attach to video element
videoEl.srcObject = remoteStream;
videoEl.onloadedmetadata = () => {
  videoEl.play().catch(err => console.warn("Auto-play blocked:", err));
};
}

let currentSlide = 0;
let slides = [];
let slideTimeline = [];

// Teacher: broadcast slide index
function teacherChangeSlide(index) {
  if (index < 0 || index >= slides.length) return;

  currentSlide = index;
  showSlide(index, "teacher-live-slides");

  // 👉 Send slide index over Supabase Realtime channel
  window.supabaseHelpers.rtc.sendSignal(channel, {
    type: "slide",
    slideIndex: index
  });
}


// Student: listen for slide events
function handleSlideSync(data) {
  if (data.type === "slide") {
    currentSlide = data.slideIndex;
    showSlide(currentSlide, "student-slide-container");
  }
}

// Utility to display slide
function showSlide(index, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !slides.length) return;
  container.innerHTML = "";
  const img = document.createElement("img");
  img.src = slides[index];
  img.style.maxWidth = "100%";
  container.appendChild(img);
}

document.getElementById("upload-slides")?.addEventListener("click", async () => {
  const files = document.getElementById("live-slides").files;
  if (!files.length) return alert("Select slides!");

  // zip them
  const zip = new JSZip();
  [...files].forEach((f, i) => zip.file(`${i + 1}.png`, f));

  const content = await zip.generateAsync({ type: "blob" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `live_math101_${timestamp}.zip`;

  // upload to Supabase
  await window.supabaseHelpers.storage.uploadLecture(content, path);

  // insert into lectures table
  await window.supabaseHelpers.db.createLecture({
    class_id: 1,   // TODO: real class id
    storage_path: path,
    is_live: true
  });

  alert("Slides uploaded ✅. Now available in Live Class tab.");

  // load them for teacher preview
  slides = [...files].map(f => URL.createObjectURL(f));
  currentSlide = 0;
  showSlide(currentSlide, "teacher-live-slides");
});


document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
    });
  });
});
