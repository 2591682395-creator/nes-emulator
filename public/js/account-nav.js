(function () {
  "use strict";
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user_data") || "null"); } catch (_) {}
  document.querySelectorAll("[data-account-link]").forEach(link => {
    link.textContent = user ? (user.nickname || user.username || "用户中心") : "登录 / 注册";
    link.title = user ? "进入用户中心" : "登录或注册账号";
  });
})();
