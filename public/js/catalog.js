(function () {
  "use strict";
  let category = new URLSearchParams(location.search).get("cat") || "all";
  let page = 1;
  let totalPages = 1;
  let timer;
  const tabs = document.getElementById("categoryTabs");
  const grid = document.getElementById("gameGrid");
  const search = document.getElementById("searchInput");
  const more = document.getElementById("loadMore");
  const count = document.getElementById("resultCount");

  const script = document.createElement("script");
  script.src = "/js/ui.js";
  script.onload = init;
  document.head.appendChild(script);

  async function init() {
    await loadCategories();
    loadGames();
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { page = 1; loadGames(); }, 280);
    });
    document.getElementById("loadMoreButton").addEventListener("click", () => { page += 1; loadGames(true); });
  }

  async function loadCategories() {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("分类请求失败");
      const payload = await response.json();
      const categories = payload?.code === 0 ? payload.data || [] : [];
      tabs.innerHTML = `<button class="tab-btn ${category === "all" ? "active" : ""}" data-id="all">全部游戏</button>` + categories.map(item =>
        `<button class="tab-btn ${String(item.id) === category ? "active" : ""}" data-id="${PixelUI.escape(item.id)}">${PixelUI.escape(item.icon || "◆")} ${PixelUI.escape(item.name)}</button>`
      ).join("");
    } catch (error) {
      console.warn("分类加载失败:", error);
    }
    tabs.addEventListener("click", event => {
      const button = event.target.closest("button[data-id]");
      if (!button) return;
      tabs.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      category = button.dataset.id; page = 1; loadGames();
    });
  }

  async function loadGames(append = false) {
    if (!append) grid.innerHTML = PixelUI.empty("正在读取卡带目录...");
    const params = new URLSearchParams({ page, pageSize: 12 });
    if (category !== "all") params.set("category_id", category);
    if (search.value.trim()) params.set("keyword", search.value.trim());
    try {
      const response = await fetch(`/api/games?${params}`);
      if (!response.ok) throw new Error("游戏请求失败");
      const payload = await response.json();
      if (payload?.code !== 0) throw new Error(payload?.message || "接口异常");
      const games = payload.data?.list || [];
      const html = games.map((game, index) => PixelUI.gameCard(game, (page - 1) * 12 + index)).join("");
      grid.innerHTML = append ? grid.innerHTML + html : (html || PixelUI.empty("没有找到对应游戏，换个关键词试试。"));
      totalPages = Number(payload.data?.totalPages) || 1;
      count.textContent = Number(payload.data?.total) || games.length;
      more.hidden = page >= totalPages;
    } catch (error) {
      console.warn("游戏列表加载失败:", error);
      if (!append) grid.innerHTML = PixelUI.empty("游戏列表暂时无法读取，请稍后重试。");
      more.hidden = true; count.textContent = "0";
    }
  }
})();
