// app.js

// Online login
document.getElementById("login-btn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  if (!username || !password) {
    alert("Enter username and password!");
    return;
  }

  const { data, error } = await window.supabaseHelpers.users.login(username, password);

  if (error || !data) {
    alert("❌ Invalid credentials");
    return;
  }

  if (data.role !== role) {
    alert(`❌ This account is not a ${role}`);
    return;
  }

  localStorage.setItem("remoteclass_user", JSON.stringify(data));

  if (role === "teacher") {
    window.location.href = "teacher-online.html";
  } else {
    window.location.href = "student-online.html";
  }
});

// Online signup
document.getElementById("signup-btn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  if (!username || !password) {
    alert("Enter username and password!");
    return;
  }

  const { data, error } = await window.supabaseHelpers.users.signup(username, password, role);

  if (error) {
    alert("❌ Error creating account: " + error.message);
    return;
  }

  alert("✅ Account created! Now login.");
});

// Offline buttons
document.getElementById("offline-student")?.addEventListener("click", () => {
  window.location.href = "student-offline.html";
});

document.getElementById("offline-teacher")?.addEventListener("click", () => {
  window.location.href = "teacher-offline.html";
});
