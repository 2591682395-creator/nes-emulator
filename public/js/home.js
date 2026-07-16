(function () {
  "use strict";
  const script = document.createElement("script");
  script.src = "/js/ui.js";
  script.onload = loadFeaturedGames;
  document.head.appendChild(script);

  async function loadFeaturedGames() {
    const grid = document.getElementById("hotGames");
    try {
      const response = await fetch("/api/games?pageSize=8");
      if (!response.ok) throw new Error("网络响应异常");
      const payload = await response.json();
      const games = payload?.code === 0 ? payload.data?.list || [] : [];
      grid.innerHTML = games.length
        ? games.map((game, index) => PixelUI.gameCard(game, index)).join("")
        : PixelUI.empty("卡带架暂时是空的，去管理后台添加游戏吧。");
    } catch (error) {
      console.warn("精选游戏加载失败:", error);
      grid.innerHTML = PixelUI.empty("游戏列表暂时无法读取，请稍后再来。");
    }
  }
})();
