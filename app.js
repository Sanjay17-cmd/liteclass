if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("Service Worker Registered"));
}
let slides = ["slide1.jpg", "slide2.jpg", "slide3.jpg"];
let current = 0;

function showSlide() {
  document.getElementById("slide").src = slides[current];
}

function prevSlide() {
  if (current > 0) current--;
  showSlide();
}

function nextSlide() {
  if (current < slides.length - 1) current++;
  showSlide();
}

// Simulated download (demo only)
function downloadLecture() {
  alert("Lecture ZIP downloaded (demo)!");
}

