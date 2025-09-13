document.getElementById("go-online")?.addEventListener("click", () => {
  const role = document.getElementById("role").value;
  if (role === "student") {
    window.location.href = "student-online.html";
  } else {
    window.location.href = "teacher-online.html";
  }
});

document.getElementById("go-offline")?.addEventListener("click", () => {
  const role = document.getElementById("role").value;
  if (role === "student") {
    window.location.href = "student-offline.html";
  } else {
    window.location.href = "teacher-offline.html";
  }
});
