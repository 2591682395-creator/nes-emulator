(function () {
  "use strict";
  const authPanel = document.getElementById("authPanel");
  const profilePanel = document.getElementById("profilePanel");
  const message = document.getElementById("authMessage");

  function currentUser() {
    try { return JSON.parse(localStorage.getItem("user_data") || "null"); } catch (_) { return null; }
  }
  function render() {
    const user = currentUser();
    authPanel.hidden = Boolean(user);
    profilePanel.hidden = !user;
    if (user) {
      document.getElementById("profileName").textContent = user.nickname || user.username || "玩家";
      document.getElementById("profileEmail").textContent = user.email || "云存档账号已连接";
      document.querySelector("[data-account-link]").textContent = user.nickname || user.username || "用户中心";
    }
  }
  function saveSession(payload) {
    localStorage.setItem("user_token", payload.data.token);
    localStorage.setItem("user_data", JSON.stringify(payload.data.user));
    render();
  }
  async function submit(endpoint, form) {
    message.textContent = "正在连接游戏厅...";
    const body = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) throw new Error(payload.message || "操作失败");
      saveSession(payload);
    } catch (error) { message.textContent = error.message; }
  }
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".auth-form").forEach(form => form.classList.toggle("active", form.id === `${button.dataset.tab}Form`));
    message.textContent = "";
  }));
  document.getElementById("loginForm").addEventListener("submit", event => { event.preventDefault(); submit("/api/auth/login", event.currentTarget); });
  document.getElementById("registerForm").addEventListener("submit", event => { event.preventDefault(); submit("/api/auth/register", event.currentTarget); });
  document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("user_token"); localStorage.removeItem("user_data"); render(); location.reload();
  });
  render();
})();
