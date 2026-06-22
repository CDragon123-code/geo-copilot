(function () {
  document.querySelectorAll(".geo-copilot-root").forEach((node) => node.remove());
  window.__geoCopilotLoaded = true;

  const analyzer = window.GeoCopilotAnalyzer;
  const state = {
    settings: {},
    platformRules: {},
    article: null,
    llm: null,
    activeTab: "article",
    output: "",
    started: false,
    pageSignature: "",
    pageKind: null
  };

  const root = document.createElement("div");
  root.className = "geo-copilot-root";
  root.innerHTML = `
    <button class="geo-copilot-toggle" title="打开 GEO Copilot">GEO</button>
    <section class="geo-copilot-panel" aria-live="polite">
      <header class="geo-copilot-header">
        <div class="geo-copilot-title">
          <strong>GEO Copilot</strong>
          <span class="geo-current-host"></span>
        </div>
        <button class="geo-copilot-close" title="关闭">×</button>
      </header>
      <div class="geo-copilot-body">
        <div class="geo-copilot-tabs three">
          <button class="geo-copilot-tab is-active" data-tab="article">文章仿写</button>
          <button class="geo-copilot-tab" data-tab="llm">模型来源</button>
          <button class="geo-copilot-tab" data-tab="match">产品匹配</button>
        </div>
        <div class="geo-copilot-mount"></div>
      </div>
    </section>
  `;
  document.documentElement.appendChild(root);

  const panel = root.querySelector(".geo-copilot-panel");
  const mount = root.querySelector(".geo-copilot-mount");
  const hostLabel = root.querySelector(".geo-current-host");

  root.querySelector(".geo-copilot-toggle").addEventListener("click", async () => {
    panel.classList.add("is-open");
    await preparePanel();
  });

  root.querySelector(".geo-copilot-close").addEventListener("click", () => {
    panel.classList.remove("is-open");
  });

  root.querySelectorAll(".geo-copilot-tab").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeTab = button.dataset.tab;
      root.querySelectorAll(".geo-copilot-tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      await renderCurrentState();
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "capture-article") {
      startAnalysis("article", true).then(sendResponse);
      return true;
    }
    if (message.type === "capture-llm") {
      startAnalysis("llm", true).then(sendResponse);
      return true;
    }
    if (message.type === "open-panel") {
      panel.classList.add("is-open");
      preparePanel().then(sendResponse);
      return true;
    }
    if (message.type === "clear-current-analysis") {
      clearCurrentAnalysis();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  async function getStoredState() {
    return chrome.runtime.sendMessage({ type: "get-state" }).catch(() => ({}));
  }

  async function preparePanel() {
    const stored = await getStoredState();
    state.settings = stored.settings || {};
    state.platformRules = stored.platformRules || {};
    state.pageKind = analyzer.classifyPage(document);
    hostLabel.textContent = `${state.pageKind.platform.name} · ${state.pageKind.label}`;
    if (!state.started) {
      state.activeTab = state.pageKind.kind === "llm" ? "match" : "article";
      syncActiveTab();
    }
    await renderCurrentState();
    return { ok: true };
  }

  async function renderCurrentState() {
    state.pageKind = analyzer.classifyPage(document);
    hostLabel.textContent = `${state.pageKind.platform.name} · ${state.pageKind.label}`;
    if (!state.started) {
      renderStartCard(getStartMessage());
      return;
    }
    if (state.pageSignature !== getPageSignature()) {
      renderStartCard("检测到当前页面内容已变化，请重新点击 GEO START 分析当前页面。");
      return;
    }
    if (state.activeTab === "article") renderArticle();
    if (state.activeTab === "llm") renderLLM();
    if (state.activeTab === "match") renderProductMatch();
  }

  async function startAnalysis(tab = state.activeTab, shouldSave = false) {
    const stored = await getStoredState();
    state.settings = stored.settings || {};
    state.platformRules = stored.platformRules || {};
    state.pageKind = analyzer.classifyPage(document);
    state.activeTab = tab;
    const mismatch = getModeMismatch(tab);
    if (mismatch) {
      state.started = false;
      syncActiveTab();
      renderModeBlocked(mismatch);
      return { ok: false, error: mismatch };
    }
    state.started = true;
    state.pageSignature = getPageSignature();
    state.output = "";
    syncActiveTab();

    if (tab === "article") {
      const article = analyzer.analyzeArticle(document, state.settings);
      const rule = (state.platformRules || {})[article.host] || {};
      const imitation = analyzer.createImitationPackage(article, state.settings, rule);
      state.article = shouldSave ? { ...article, imitation } : article;
      if (shouldSave) {
        const result = await chrome.runtime.sendMessage({ type: "save-capture", payload: state.article });
        renderArticle();
        return result;
      }
      renderArticle();
      return { ok: true };
    }

    const llm = analyzer.analyzeLLMAnswer(document, state.settings);
    state.llm = llm;
    if (shouldSave) {
      const result = await chrome.runtime.sendMessage({ type: "save-llm-analysis", payload: llm });
      if (tab === "match") renderProductMatch();
      else renderLLM();
      return result;
    }
    if (tab === "match") renderProductMatch();
    else renderLLM();
    return { ok: true };
  }

  function clearCurrentAnalysis() {
    state.article = null;
    state.llm = null;
    state.output = "";
    state.started = false;
    state.pageSignature = "";
    renderStartCard("已清理当前页面分析结果。");
  }

  async function clearSavedData() {
    await chrome.runtime.sendMessage({ type: "clear-all-data" });
    clearCurrentAnalysis();
  }

  function renderStartCard(message) {
    const title = getPageTitle();
    mount.innerHTML = `
      <article class="geo-copilot-card geo-copilot-start-card">
        <div class="geo-copilot-card-header">
          <h2 class="geo-copilot-card-title">手动分析</h2>
          <span class="geo-copilot-score">READY</span>
        </div>
        <div class="geo-copilot-card-body">
          <div class="geo-copilot-page-title">${escapeHtml(title)}</div>
          <div class="geo-copilot-page-url">${escapeHtml(location.href)}</div>
          <p class="geo-copilot-note">${escapeHtml(message)}</p>
          <div class="geo-copilot-actions three">
            <button class="geo-copilot-button primary" data-action="geo-start">GEO START</button>
            <button class="geo-copilot-button" data-action="clear-current">清理当前</button>
            <button class="geo-copilot-button danger" data-action="clear-saved">清空历史</button>
          </div>
        </div>
      </article>
    `;
    mount.querySelector('[data-action="geo-start"]').addEventListener("click", () => startAnalysis(state.activeTab, false));
    mount.querySelector('[data-action="clear-current"]').addEventListener("click", clearCurrentAnalysis);
    mount.querySelector('[data-action="clear-saved"]').addEventListener("click", clearSavedData);
  }

  function renderModeBlocked(message) {
    mount.innerHTML = `
      <article class="geo-copilot-card geo-copilot-start-card">
        <div class="geo-copilot-card-header">
          <h2 class="geo-copilot-card-title">模式不匹配</h2>
          <span class="geo-copilot-score">STOP</span>
        </div>
        <div class="geo-copilot-card-body">
          <div class="geo-copilot-page-title">${escapeHtml(state.pageKind.platform.name)} · ${escapeHtml(state.pageKind.label)}</div>
          <div class="geo-copilot-page-url">${escapeHtml(location.href)}</div>
          <p class="geo-copilot-note">${escapeHtml(message)}</p>
          <div class="geo-copilot-actions three">
            <button class="geo-copilot-button primary" data-action="switch-valid">切换正确模式</button>
            <button class="geo-copilot-button" data-action="clear-current">清理当前</button>
            <button class="geo-copilot-button danger" data-action="clear-saved">清空历史</button>
          </div>
        </div>
      </article>
    `;
    mount.querySelector('[data-action="switch-valid"]').addEventListener("click", () => {
      state.activeTab = state.pageKind.kind === "llm" ? "match" : "article";
      syncActiveTab();
      renderStartCard(getStartMessage());
    });
    mount.querySelector('[data-action="clear-current"]').addEventListener("click", clearCurrentAnalysis);
    mount.querySelector('[data-action="clear-saved"]').addEventListener("click", clearSavedData);
  }

  function getStartMessage() {
    if (state.pageKind && state.pageKind.kind === "llm") {
      return "当前是大模型平台。请使用“模型来源”或“产品匹配”，点击 GEO START 后分析模型回答。";
    }
    return "当前是官网/论坛/行业内容平台。请使用“文章仿写”，点击 GEO START 后分析文章结构。";
  }

  function getModeMismatch(tab) {
    if (!state.pageKind) state.pageKind = analyzer.classifyPage(document);
    if (state.pageKind.kind === "llm" && tab === "article") {
      return "当前页面是大模型平台，不能按普通文章仿写分析。请切换到“模型来源”或“产品匹配”。";
    }
    if (state.pageKind.kind === "content" && (tab === "llm" || tab === "match")) {
      return "当前页面是官网/论坛/行业内容平台，不能按大模型回答分析。请切换到“文章仿写”。";
    }
    return "";
  }

  function renderAnalysisToolbar() {
    return `
      <div class="geo-copilot-actions three">
        <button class="geo-copilot-button primary" data-action="geo-restart">GEO START</button>
        <button class="geo-copilot-button" data-action="clear-current">清理当前</button>
        <button class="geo-copilot-button danger" data-action="clear-saved">清空历史</button>
      </div>
    `;
  }

  function bindAnalysisToolbar() {
    mount.querySelectorAll('[data-action="geo-restart"]').forEach((button) => button.addEventListener("click", () => startAnalysis(state.activeTab, false)));
    mount.querySelectorAll('[data-action="clear-current"]').forEach((button) => button.addEventListener("click", clearCurrentAnalysis));
    mount.querySelectorAll('[data-action="clear-saved"]').forEach((button) => button.addEventListener("click", clearSavedData));
  }

  function renderArticle() {
    const article = state.article || analyzer.analyzeArticle(document, state.settings);
    state.article = article;
    const rule = state.platformRules[article.host] || {};
    const imitation = article.imitation || analyzer.createImitationPackage(article, state.settings, rule);
    const output = state.output || imitation.prompt;
    mount.innerHTML = `
      <article class="geo-copilot-card">
        <div class="geo-copilot-card-header">
          <h2 class="geo-copilot-card-title">当前文章结构</h2>
          <span class="geo-copilot-score">${article.platformFit.score}</span>
        </div>
        <div class="geo-copilot-card-body">
          ${renderAnalysisToolbar()}
          <div class="geo-copilot-kv"><span>标题</span><strong>${escapeHtml(article.title || "未识别")}</strong></div>
          <div class="geo-copilot-kv"><span>类型</span><span>${escapeHtml(article.structure.pattern)} · ${article.wordCount.total} 字符/词</span></div>
          <div class="geo-copilot-kv"><span>型号</span><span>${escapeHtml(article.productModels.map((item) => item.name).slice(0, 8).join("、") || "未识别")}</span></div>
          <div class="geo-copilot-tags">${article.keywords.slice(0, 10).map((item) => `<span class="geo-copilot-tag">${escapeHtml(item.term)}</span>`).join("")}</div>
          <ul class="geo-copilot-list">${article.recommendations.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>
          <div class="geo-copilot-actions">
            <button class="geo-copilot-button primary" data-action="save-article">保存结构</button>
            <button class="geo-copilot-button" data-action="copy-prompt">复制提示词</button>
            <button class="geo-copilot-button" data-action="show-draft">草稿框架</button>
            <button class="geo-copilot-button" data-action="copy-outline">复制大纲</button>
          </div>
          <pre class="geo-copilot-output">${escapeHtml(output)}</pre>
        </div>
      </article>
    `;
    bindAnalysisToolbar();
    bindArticleActions(article, imitation);
  }

  function renderLLM() {
    const llm = state.llm || analyzer.analyzeLLMAnswer(document, state.settings);
    state.llm = llm;
    mount.innerHTML = `
      <article class="geo-copilot-card">
        <div class="geo-copilot-card-header">
          <h2 class="geo-copilot-card-title">大模型 GEO 诊断</h2>
          <span class="geo-copilot-score">${llm.geoFit.score}</span>
        </div>
        <div class="geo-copilot-card-body">
          ${renderAnalysisToolbar()}
          <div class="geo-copilot-kv"><span>回答类型</span><strong>${escapeHtml(llm.answerPattern)}</strong></div>
          <div class="geo-copilot-kv"><span>品牌命中</span><span>${llm.entityHits.length ? escapeHtml(llm.entityHits.join("、")) : "暂未命中"}</span></div>
          <div class="geo-copilot-kv"><span>来源域名</span><span>${llm.domains.length ? escapeHtml(llm.domains.slice(0, 8).join("、")) : "未发现显式外链"}</span></div>
          <div class="geo-copilot-tags">${llm.keywords.slice(0, 10).map((item) => `<span class="geo-copilot-tag">${escapeHtml(item.term)}</span>`).join("")}</div>
          <ul class="geo-copilot-list">${llm.recommendations.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>
          <div class="geo-copilot-actions">
            <button class="geo-copilot-button primary" data-action="save-llm">保存诊断</button>
            <button class="geo-copilot-button" data-action="copy-geo">复制建议</button>
          </div>
          <pre class="geo-copilot-output">${escapeHtml(buildGeoBrief(llm))}</pre>
        </div>
      </article>
    `;
    bindAnalysisToolbar();
    bindLLMActions(llm);
  }

  function renderProductMatch() {
    const llm = state.llm || analyzer.analyzeLLMAnswer(document, state.settings);
    state.llm = llm;
    const match = llm.productMatch;
    mount.innerHTML = `
      <article class="geo-copilot-card">
        <div class="geo-copilot-card-header">
          <h2 class="geo-copilot-card-title">产品推荐匹配</h2>
          <span class="geo-copilot-score">${match.score}</span>
        </div>
        <div class="geo-copilot-card-body">
          ${renderAnalysisToolbar()}
          <div class="geo-copilot-kv"><span>搜索意图</span><strong>${escapeHtml(match.intent.intent)}</strong></div>
          <div class="geo-copilot-kv"><span>我的型号</span><span>${escapeHtml(match.ownModels.join("、") || "请在工作台公司资料中填写，如 WD6208A")}</span></div>
          <div class="geo-copilot-kv"><span>已推荐</span><span>${escapeHtml(match.recommended.slice(0, 8).map((item) => item.model).join("、") || "未识别到型号")}</span></div>
          <h3 class="geo-copilot-section-title">模型推荐原因</h3>
          ${renderModelRows(match.recommended.slice(0, 6))}
          <h3 class="geo-copilot-section-title">内容缺口</h3>
          <ul class="geo-copilot-list">${match.contentGaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>
          <h3 class="geo-copilot-section-title">优先发布平台</h3>
          ${renderPlatformPlan(match.platformPlan)}
          <div class="geo-copilot-actions">
            <button class="geo-copilot-button primary" data-action="save-match">保存诊断</button>
            <button class="geo-copilot-button" data-action="copy-match-prompt">复制发布方案提示词</button>
          </div>
          <pre class="geo-copilot-output">${escapeHtml(match.prompt)}</pre>
        </div>
      </article>
    `;
    bindAnalysisToolbar();
    mount.querySelector('[data-action="save-match"]').addEventListener("click", () => startAnalysis("match", true));
    mount.querySelector('[data-action="copy-match-prompt"]').addEventListener("click", () => copyText(match.prompt));
  }

  function renderModelRows(models) {
    if (!models.length) return `<div class="geo-copilot-empty-mini">没有识别到型号。可尝试让大模型回答中包含“推荐型号/参数对比”。</div>`;
    return `<div class="geo-copilot-model-list">${models.map((item) => `
      <div class="geo-copilot-model-row">
        <strong>${escapeHtml(item.model)}${item.isMine ? " · 我的产品" : ""}</strong>
        <span>${item.reasons.length ? escapeHtml(item.reasons.join("、")) : "出现频次较低，推荐理由不明确"}</span>
      </div>
    `).join("")}</div>`;
  }

  function renderPlatformPlan(plan) {
    return `<div class="geo-copilot-model-list">${plan.map((item) => `
      <div class="geo-copilot-model-row">
        <strong>${escapeHtml(item.platform)} · ${item.score}${item.fromSource ? " · 来源命中" : " · 兜底"}</strong>
        <span>${escapeHtml(item.articleType)}：${escapeHtml(item.reason)}</span>
      </div>
    `).join("")}</div>`;
  }

  function bindArticleActions(article, imitation) {
    mount.querySelector('[data-action="save-article"]').addEventListener("click", () => startAnalysis("article", true));
    mount.querySelector('[data-action="copy-prompt"]').addEventListener("click", () => copyText(imitation.prompt));
    mount.querySelector('[data-action="show-draft"]').addEventListener("click", () => {
      state.output = imitation.draft;
      renderArticle();
    });
    mount.querySelector('[data-action="copy-outline"]').addEventListener("click", () => {
      const outline = article.structure.outline.map((item) => `${"  ".repeat(Math.max(0, item.level - 1))}${item.text}`).join("\n");
      copyText(outline || article.title);
    });
  }

  function bindLLMActions() {
    mount.querySelector('[data-action="save-llm"]').addEventListener("click", () => startAnalysis("llm", true));
    mount.querySelector('[data-action="copy-geo"]').addEventListener("click", () => copyText(buildGeoBrief(state.llm)));
  }

  function syncActiveTab() {
    root.querySelectorAll(".geo-copilot-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === state.activeTab));
  }

  function getPageTitle() {
    return analyzer.cleanText(document.querySelector("h1")?.innerText || document.title || "当前页面");
  }

  function getPageSignature() {
    const text = analyzer.cleanText(document.body?.innerText || "");
    return `${location.href}|${document.title}|${text.length}|${hashText(text.slice(0, 1000) + text.slice(-1000))}`;
  }

  function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return String(hash);
  }

  function buildGeoBrief(llm) {
    return [
      `平台：${llm.platform.name}`,
      `回答类型：${llm.answerPattern}`,
      `GEO 适配分：${llm.geoFit.score}`,
      `命中实体：${llm.entityHits.join("、") || "无"}`,
      `来源域名：${llm.domains.join("、") || "未发现显式来源"}`,
      "",
      "优化动作：",
      ...llm.recommendations.map((tip, index) => `${index + 1}. ${tip}`)
    ].join("\n");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
