(function () {
  "use strict";

  window.PixelUI = {
    escape(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },
    gameCard(game, index = 0) {
      const safe = this.escape;
      const cover = safe(game.cover_path || "/uploads/covers/default.svg");
      return `<a href="/pages/play.html?id=${encodeURIComponent(game.id)}" class="game-card">
        <div class="game-card-cover-wrapper">
          <img class="game-card-cover" src="${cover}" alt="${safe(game.title)}" loading="lazy" onerror="this.onerror=null;this.src='/uploads/covers/default.svg'">
          <span class="game-card-number">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <div class="game-card-info"><h3 class="game-card-title">${safe(game.title)}</h3>
          <div class="game-card-meta"><span class="game-card-tag">${safe(game.category_name || "经典游戏")}</span><span>${Number(game.play_count) || 0} 次</span></div>
        </div></a>`;
    },
    empty(message) {
      return `<div class="empty-state">${this.escape(message)}</div>`;
    }
  };
})();
