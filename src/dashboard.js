const PROVIDERS = {
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  qwen: { label: "通义千问 / Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  doubao: { label: "豆包 / 火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6" },
  kimi: { label: "Kimi / Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  zhipu: { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  custom: { label: "自定义 OpenAI-compatible", baseUrl: "", model: "" }
};

const DEFAULT_SETTINGS = {
  companyName: "",
  industry: "",
  bannedClaims: "保证排名、百分百收录、绝对替代、夸大性能",
  tone: "专业、可信、清晰、可执行"
};

const DEFAULT_API_CONFIG = {
  provider: "deepseek",
  baseUrl: PROVIDERS.deepseek.baseUrl,
  model: PROVIDERS.deepseek.model,
  apiKey: "",
  temperature: 0.3
};

const ENTITY_GUARDRAILS = [
  "不要把插件状态词当成产品或竞品：START、READY、STOP、GEO START。",
  "不要把协议/接口当成产品或竞品：MQTT、UART、SPI、I2C、PWM、GPIO、USB、CAN、LIN。",
  "不要把封装当成产品或竞品：SOT23-6、SOP8、QFN、DFN、DIP、BGA 等。",
  "不要把MCU/平台/系统当成产品或竞品：STM32、ESP32、Arduino、Linux、RTOS 等。",
  "只有用户在GEO投放仿写输入框里明确提供的名称，才可以作为本次主推产品或竞品。"
];

const viewTitle = document.getElementById("viewTitle");
const viewSubtitle = document.getElementById("viewSubtitle");
const viewMount = document.getElementById("viewMount");
const exportButton = document.getElementById("exportData");

let state = {
  settings: DEFAULT_SETTINGS,
  captures: [],
  llmAnalyses: [],
  apiConfig: DEFAULT_API_CONFIG,
  aiReports: [],
  aiDrafts: [],
  aiReviews: []
};
let activeView = "ai";

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    render();
  });
});

exportButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
  flashButton(exportButton, "已复制");
});

load();

async function load() {
  const stored = await chrome.storage.local.get([
    "settings",
    "captures",
    "llmAnalyses",
    "apiConfig",
    "aiReports",
    "aiDrafts",
    "aiReviews"
  ]);
  state = {
    settings: sanitizeSettings(stored.settings),
    captures: stored.captures || [],
    llmAnalyses: stored.llmAnalyses || [],
    apiConfig: { ...DEFAULT_API_CONFIG, ...(stored.apiConfig || {}) },
    aiReports: stored.aiReports || [],
    aiDrafts: stored.aiDrafts || [],
    aiReviews: stored.aiReviews || []
  };
  render();
}

function sanitizeSettings(settings = {}) {
  return {
    companyName: settings.companyName || "",
    industry: settings.industry || "",
    bannedClaims: settings.bannedClaims || DEFAULT_SETTINGS.bannedClaims,
    tone: settings.tone || DEFAULT_SETTINGS.tone
  };
}

function render() {
  if (activeView === "ai") renderAi();
  if (activeView === "settings") renderSettings();
  if (activeView === "records") renderRecords();
}

function setHeader(title, subtitle) {
  viewTitle.textContent = title;
  viewSubtitle.textContent = subtitle;
}

function renderAi() {
  setHeader("GEO闭环工作台", "按你的真实流程：模型检索、来源定位、结构仿写、去雷同改写、发布复测。");
  const latestReport = state.aiReports[0];
  const latestDraft = state.aiDrafts[0];
  const latestReview = state.aiReviews[0];

  viewMount.innerHTML = `
    <section class="ai-hero">
      <article class="panel-card ai-command">
        <div class="section-heading">
          <h2>1. 模型来源诊断</h2>
          <span>${escapeHtml(getProviderLabel(state.apiConfig.provider))} · ${escapeHtml(state.apiConfig.model || "未设置模型")}</span>
        </div>
        <p class="muted-line">${renderDataSummary()}</p>
        <div class="toolbar">
          <button id="runDiagnosis" class="primary-button">生成来源诊断</button>
          <button id="copyPrompt" class="secondary-button">复制诊断提示词</button>
        </div>
        <p class="hint-line">先在大模型里搜索产品问题，再用 GEO START 采集回答和引用链接。这里负责判断模型引用了哪些平台、为什么推荐这些内容、下一篇文章应该适配哪个平台。</p>
      </article>

      <article class="panel-card">
        <div class="section-heading">
          <h2>闭环进度</h2>
          <span>${escapeHtml(getReadinessLabel())}</span>
        </div>
        ${renderInputChecklist()}
      </article>
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>诊断结果</h2>
        <span>${latestReport ? formatDate(latestReport.createdAt) : "等待生成"}</span>
      </div>
      <textarea id="aiOutput" class="output ai-output" readonly>${escapeHtml(latestReport?.result || "还没有诊断结果。先在大模型页面搜索目标问题并点击 GEO START 采集，再回到这里生成诊断。")}</textarea>
      <div class="toolbar">
        <button id="copyOutput" class="primary-button" ${latestReport ? "" : "disabled"}>复制诊断</button>
        <button id="copyArticle" class="secondary-button" ${latestReport ? "" : "disabled"}>复制文章框架</button>
      </div>
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>2. 结构仿写与去雷同</h2>
        <span>${latestReport ? "将使用最新诊断" : "建议先完成诊断"}</span>
      </div>
      <div class="draft-layout">
        <div class="form-field">
          <label for="draftInput">粘贴参考文章结构 + 本次产品资料</label>
          <textarea id="draftInput" class="draft-input" placeholder="建议粘贴三类信息：1）目标问题，例如“IR-CUT驱动芯片选型”；2）从引用平台复制来的参考文章或文章大纲；3）本次要发布的产品资料、规格参数、资料链接、发布平台。AI会借鉴结构和平台规则，但会重组标题、段落顺序、表达和案例，降低雷同风险。"></textarea>
        </div>
        <div class="draft-side">
          <p class="muted-line">输出会包含：可发布正文、编辑器排版版本、原创化说明、发布前检查清单。重点是“模仿结构，不复制表达”。</p>
          <button id="runDraft" class="primary-button">生成发布稿</button>
          <button id="copyDraft" class="secondary-button" ${latestDraft ? "" : "disabled"}>复制最新文章</button>
        </div>
      </div>
      <textarea id="draftOutput" class="output ai-output draft-output" readonly>${escapeHtml(latestDraft?.result || "生成后的投放文章会显示在这里。")}</textarea>
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>3. 发布后复测</h2>
        <span>${latestReview ? formatDate(latestReview.createdAt) : "等待复测"}</span>
      </div>
      <div class="draft-layout">
        <div class="form-field">
          <label for="reviewInput">粘贴原始问题、发布链接、几天后的模型回答</label>
          <textarea id="reviewInput" class="draft-input" placeholder="例如：原始问题、发布平台和文章链接、目标产品、几天后在DeepSeek/豆包/Qwen得到的新回答。AI会判断是否被推荐、来源是否命中、下一轮应该补什么内容。"></textarea>
        </div>
        <div class="draft-side">
          <p class="muted-line">复测不是重新写文章，而是判断这一轮是否有效：是否推荐你的产品、是否引用目标平台、是否需要追加对比/参数/FAQ内容。</p>
          <button id="runReview" class="primary-button">生成复测结论</button>
          <button id="copyReview" class="secondary-button" ${latestReview ? "" : "disabled"}>复制最新复测</button>
        </div>
      </div>
      <textarea id="reviewOutput" class="output ai-output draft-output" readonly>${escapeHtml(latestReview?.result || "发布几天后，把同一问题的新模型回答粘贴到这里，生成下一轮优化建议。")}</textarea>
    </section>
  `;

  document.getElementById("runDiagnosis").addEventListener("click", runDiagnosis);
  document.getElementById("copyPrompt").addEventListener("click", () => copyText(buildDiagnosisPrompt()));
  document.getElementById("copyOutput").addEventListener("click", () => copyText(document.getElementById("aiOutput").value));
  document.getElementById("copyArticle").addEventListener("click", () => copyText(extractArticleTemplate(document.getElementById("aiOutput").value)));
  document.getElementById("runDraft").addEventListener("click", runDraft);
  document.getElementById("copyDraft").addEventListener("click", () => copyText(document.getElementById("draftOutput").value));
  document.getElementById("runReview").addEventListener("click", runReview);
  document.getElementById("copyReview").addEventListener("click", () => copyText(document.getElementById("reviewOutput").value));
}

function renderSettings() {
  setHeader("设置", "这里只保留长期基础信息。具体写什么，统一放到GEO投放仿写里。");
  const s = state.settings;
  const api = state.apiConfig;
  viewMount.innerHTML = `
    <section class="settings-layout">
      <article class="panel-card">
        <div class="section-heading">
          <h2>基础信息</h2>
          <span>长期不变</span>
        </div>
        <form id="settingsForm" class="form-grid">
          <div class="form-field">
            <label for="companyName">公司/品牌</label>
            <input id="companyName" value="${escapeAttr(s.companyName)}" placeholder="例如：维得半导体">
          </div>
          <div class="form-field">
            <label for="industry">行业场景</label>
            <input id="industry" value="${escapeAttr(s.industry)}" placeholder="例如：安防摄像头芯片、B2B工业软件">
          </div>
          <div class="form-field full">
            <label for="bannedClaims">禁用表达</label>
            <input id="bannedClaims" value="${escapeAttr(s.bannedClaims)}" placeholder="保证排名、百分百收录、绝对替代、夸大性能">
          </div>
          <div class="toolbar form-field full">
            <button class="primary-button" type="submit">保存基础信息</button>
          </div>
        </form>
      </article>

      <article class="panel-card">
        <div class="section-heading">
          <h2>大模型API</h2>
          <span>OpenAI-compatible</span>
        </div>
        <form id="apiForm" class="form-grid">
          <div class="form-field full">
            <label for="provider">模型服务商</label>
            <select id="provider">${Object.entries(PROVIDERS).map(([key, item]) => `<option value="${key}" ${api.provider === key ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select>
          </div>
          <div class="form-field full">
            <label for="baseUrl">Base URL</label>
            <input id="baseUrl" value="${escapeAttr(api.baseUrl)}" placeholder="https://api.example.com/v1">
          </div>
          <div class="form-field">
            <label for="model">模型名称</label>
            <input id="model" value="${escapeAttr(api.model)}" placeholder="deepseek-chat / qwen-plus / gpt-4o-mini">
          </div>
          <div class="form-field">
            <label for="temperature">温度</label>
            <input id="temperature" type="number" min="0" max="1" step="0.1" value="${escapeAttr(api.temperature)}">
          </div>
          <div class="form-field full">
            <label for="apiKey">API Key</label>
            <input id="apiKey" type="password" value="${escapeAttr(api.apiKey || "")}" placeholder="仅保存在浏览器本地">
          </div>
          <div class="toolbar form-field full">
            <button class="primary-button" type="submit">保存API设置</button>
            <button class="secondary-button" type="button" id="testPrompt">复制测试提示词</button>
          </div>
        </form>
      </article>
    </section>
  `;

  document.getElementById("settingsForm").addEventListener("submit", saveBasicSettings);
  document.getElementById("apiForm").addEventListener("submit", saveApiSettings);
  document.getElementById("provider").addEventListener("change", applyProviderPreset);
  document.getElementById("testPrompt").addEventListener("click", () => copyText("请用一句话回复：GEO Copilot API 测试成功。"));
}

function renderRecords() {
  setHeader("记录", "诊断报告、投放文章和采集数据分开保存，方便回看和复制。");
  viewMount.innerHTML = `
    <section class="panel-card">
      <div class="section-heading">
        <h2>AI诊断记录</h2>
        <span>${state.aiReports.length} 条</span>
      </div>
      ${state.aiReports.length ? `<div class="record-list">${state.aiReports.map((item) => renderReportCard(item, "diagnosis")).join("")}</div>` : renderEmpty("暂无AI诊断记录。")}
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>投放文章记录</h2>
        <span>${state.aiDrafts.length} 条</span>
      </div>
      ${state.aiDrafts.length ? `<div class="record-list">${state.aiDrafts.map((item) => renderReportCard(item, "draft")).join("")}</div>` : renderEmpty("暂无投放文章记录。")}
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>发布复测记录</h2>
        <span>${state.aiReviews.length} 条</span>
      </div>
      ${state.aiReviews.length ? `<div class="record-list">${state.aiReviews.map((item) => renderReportCard(item, "review")).join("")}</div>` : renderEmpty("暂无发布复测记录。")}
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>采集数据</h2>
        <span>模型诊断 ${state.llmAnalyses.length} · 文章样本 ${state.captures.length}</span>
      </div>
      <div class="toolbar">
        <button id="clearData" class="danger-button">清空采集、诊断和投放稿</button>
      </div>
      ${renderCollectedSummary()}
    </section>
  `;
  document.getElementById("clearData").addEventListener("click", clearAllData);
  bindCopyButtons();
}

async function runDiagnosis() {
  const button = document.getElementById("runDiagnosis");
  const output = document.getElementById("aiOutput");
  button.disabled = true;
  button.textContent = "诊断中...";
  output.value = "正在调用大模型，请稍等...";

  const prompt = buildDiagnosisPrompt();
  const result = await chrome.runtime.sendMessage({ type: "run-ai-diagnosis", payload: { prompt } });
  if (!result.ok) {
    output.value = result.error || "AI诊断失败。";
    button.disabled = false;
    button.textContent = "生成GEO诊断";
    return;
  }
  await load();
  activeView = "ai";
  renderAi();
}

async function runDraft() {
  const button = document.getElementById("runDraft");
  const input = document.getElementById("draftInput").value.trim();
  const output = document.getElementById("draftOutput");
  if (!input) {
    output.value = "请先粘贴本次要投放的内容、产品资料或规格参数。";
    return;
  }

  button.disabled = true;
  button.textContent = "生成中...";
  output.value = "正在根据诊断结果和本次输入生成投放文章...";

  const prompt = buildDraftPrompt(input);
  const result = await chrome.runtime.sendMessage({ type: "run-ai-draft", payload: { prompt, input } });
  if (!result.ok) {
    output.value = result.error || "投放文章生成失败。";
    button.disabled = false;
    button.textContent = "生成投放文章";
    return;
  }
  await load();
  activeView = "ai";
  renderAi();
}

async function runReview() {
  const button = document.getElementById("runReview");
  const input = document.getElementById("reviewInput").value.trim();
  const output = document.getElementById("reviewOutput");
  if (!input) {
    output.value = "请先粘贴原始问题、发布链接、目标产品和几天后的模型回答。";
    return;
  }

  button.disabled = true;
  button.textContent = "复测中...";
  output.value = "正在分析这一轮发布是否产生效果...";

  const prompt = buildReviewPrompt(input);
  const result = await chrome.runtime.sendMessage({ type: "run-ai-review", payload: { prompt, input } });
  if (!result.ok) {
    output.value = result.error || "复测分析失败。";
    button.disabled = false;
    button.textContent = "生成复测结论";
    return;
  }
  await load();
  activeView = "ai";
  renderAi();
}

async function saveBasicSettings(event) {
  event.preventDefault();
  const settings = sanitizeSettings({
    companyName: document.getElementById("companyName").value.trim(),
    industry: document.getElementById("industry").value.trim(),
    bannedClaims: document.getElementById("bannedClaims").value.trim(),
    tone: DEFAULT_SETTINGS.tone
  });
  state.settings = settings;
  await chrome.storage.local.set({ settings });
  renderSettings();
}

async function saveApiSettings(event) {
  event.preventDefault();
  const apiConfig = {
    provider: document.getElementById("provider").value,
    baseUrl: document.getElementById("baseUrl").value.trim(),
    model: document.getElementById("model").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    temperature: Number(document.getElementById("temperature").value) || 0.3
  };
  state.apiConfig = apiConfig;
  await chrome.runtime.sendMessage({ type: "save-api-config", payload: apiConfig });
  renderSettings();
}

function applyProviderPreset() {
  const key = document.getElementById("provider").value;
  const preset = PROVIDERS[key];
  if (!preset || key === "custom") return;
  document.getElementById("baseUrl").value = preset.baseUrl;
  document.getElementById("model").value = preset.model;
}

function buildDiagnosisPrompt() {
  const context = {
    company: state.settings,
    guardrails: ENTITY_GUARDRAILS,
    collected: {
      llmAnalysisCount: state.llmAnalyses.length,
      articleSampleCount: state.captures.length,
      latestModelAnalyses: state.llmAnalyses.slice(0, 5).map(compactLLMAnalysis),
      articleSamples: state.captures.slice(0, 5).map(compactArticleSample)
    }
  };

  return [
    "请基于下面的GEO采集数据，输出一份可执行方案。不要解释分析过程，直接给结论。",
    "",
    "重要识别规则：",
    ...ENTITY_GUARDRAILS.map((item) => `- ${item}`),
    "- 如果采集数据中出现明显误识别，请在结论中纠正，不要沿用错误分类。",
    "- 本阶段没有固定主推产品；具体主推对象会在GEO投放仿写输入框里提供。",
    "",
    "输出格式必须包含：",
    "## 1. AI诊断结论",
    "- 当前大模型在推荐哪些真实产品/型号/品牌",
    "- 为什么推荐这些产品/型号/品牌/来源",
    "- 当前回答体现了哪些推荐习惯、信息结构和引用偏好",
    "- 这些推荐来自哪些平台链接或来源域名",
    "",
    "## 2. 优先发布平台",
    "- 按优先级列出平台",
    "- 平台优先级必须来自大模型引用来源、来源频次、行业相关性和平台可信度，不要固定推荐",
    "- 标记：模型来源命中 / 行业兜底",
    "",
    "## 3. 内容缺口",
    "- 参数缺口",
    "- 场景缺口",
    "- 对比缺口",
    "- 来源可信度缺口",
    "",
    "## 4. 投放文章结构框架",
    "- 给出最适合发布的文章结构",
    "- 必须包含参数表、竞品对比、应用场景、FAQ、资料链接位置",
    "- 说明参考文章中哪些结构可以借鉴，哪些表达不能照搬",
    "",
    "## 5. GEO投放仿写指令",
    "- 说明用户下一步应该在投放仿写里补充哪些内容",
    "- 说明文章生成时应该优先适配哪些平台、标题形态和结构",
    "- 给出去雷同要求：标题重写、段落顺序重组、案例替换、参数表原创化、FAQ问题重写",
    "",
    "## 6. 标题方向",
    "- 给出10个标题方向，不要绑定未提供的主推产品",
    "",
    "采集数据如下：",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function buildDraftPrompt(userInput) {
  const context = {
    company: state.settings,
    latestDiagnosis: state.aiReports[0]?.result || "",
    latestModelAnalyses: state.llmAnalyses.slice(0, 5).map(compactLLMAnalysis),
    articleSamples: state.captures.slice(0, 5).map(compactArticleSample),
    guardrails: ENTITY_GUARDRAILS,
    userMaterial: userInput
  };

  return [
    "请基于GEO诊断结果和用户本次输入，直接输出一篇可复制发布的中文文章。",
    "",
    "写作要求：",
    "- 以用户本次输入为唯一可靠的产品、型号、参数和写作方向来源。",
    "- 先从用户输入中识别本次主推对象、应用场景、可对比对象和资料来源；无法判断就标记“待补充”。",
    "- 优先适配最新诊断中权重最高的平台和文章结构。",
    "- 允许借鉴参考文章的结构、栏目顺序和信息密度，但不能复制原文句子、段落表达、案例叙述和标题模板。",
    "- 必须主动做去雷同处理：重写标题角度、重组段落顺序、替换开头切入、改写FAQ问题、用本次产品资料重建参数表。",
    "- 没有给出的参数不要编造，用“待补充”标记。",
    "- 必须区分产品型号、品牌、协议、封装、平台，不要把MQTT、STM32、SOT23-6、START、READY当成产品或竞品。",
    "- 不承诺排名，不夸大性能，不写无法验证的替代关系。",
    "- 文章要能被大模型抓取：型号全称、应用场景、关键参数、对比对象、资料来源、FAQ要清晰出现。",
    "- 避免这些表达：" + (state.settings.bannedClaims || DEFAULT_SETTINGS.bannedClaims),
    "",
    "输出格式：",
    "## 建议发布平台",
    "## 标题",
    "## 摘要",
    "## 正文",
    "## 参数表",
    "## 对比与选型建议",
    "## FAQ",
    "## 原创化与平台合规检查",
    "## 编辑器发布版",
    "## 发布前需要补齐的信息",
    "",
    "上下文如下：",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function buildReviewPrompt(userInput) {
  const context = {
    company: state.settings,
    latestDiagnosis: state.aiReports[0]?.result || "",
    latestDraft: state.aiDrafts[0]?.result || "",
    latestModelAnalyses: state.llmAnalyses.slice(0, 5).map(compactLLMAnalysis),
    guardrails: ENTITY_GUARDRAILS,
    reviewMaterial: userInput
  };

  return [
    "请基于用户提供的发布后复测材料，判断这一轮GEO投放是否有效，并给出下一轮优化动作。",
    "",
    "分析要求：",
    "- 从复测材料中识别：原始问题、目标产品、发布平台/链接、复测模型、新模型回答、推荐产品、引用来源。",
    "- 判断目标产品是否被推荐：已命中 / 部分命中 / 未命中。",
    "- 判断目标发布平台是否被大模型引用或间接影响回答。",
    "- 如果未命中，说明缺的是参数、对比、场景、资料来源、平台权重还是发布时间。",
    "- 不要把协议、封装、平台词、插件状态词当作产品或竞品。",
    "",
    "输出格式：",
    "## 1. 复测结论",
    "## 2. 推荐变化",
    "## 3. 来源变化",
    "## 4. 未命中原因",
    "## 5. 下一轮投放动作",
    "## 6. 下一篇文章建议",
    "## 7. 复测问题清单",
    "",
    "上下文如下：",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function compactLLMAnalysis(item) {
  const match = item.productMatch || {};
  return {
    platform: item.platform?.name || item.host,
    url: item.url,
    answerPattern: item.answerPattern,
    sourceDomains: item.domains || [],
    entityHits: item.entityHits || [],
    recommendedModels: (match.recommended || []).slice(0, 10).map((model) => ({
      model: model.model,
      isMine: model.isMine,
      reasons: model.reasons,
      score: model.visibilityScore
    })),
    competitors: (match.competitors || []).slice(0, 8).map((model) => model.model),
    platformPlan: (match.platformPlan || []).slice(0, 6).map((plan) => ({
      platform: plan.platform,
      host: plan.host,
      score: plan.score,
      fromSource: plan.fromSource,
      reason: plan.reason,
      articleType: plan.articleType
    })),
    contentGaps: match.contentGaps || [],
    recommendations: item.recommendations || []
  };
}

function compactArticleSample(item) {
  return {
    platform: item.platform?.name || item.host,
    title: item.title,
    structurePattern: item.structure?.pattern,
    outline: (item.structure?.outline || []).slice(0, 12),
    keywords: (item.keywords || []).slice(0, 10).map((keyword) => keyword.term),
    recommendations: item.recommendations || []
  };
}

function renderDataSummary() {
  return [
    `行业：${state.settings.industry || "未设置"}`,
    `模型页：${state.llmAnalyses.length}条`,
    `文章样本：${state.captures.length}条`,
    `诊断：${state.aiReports.length}份`,
    `投放稿：${state.aiDrafts.length}篇`,
    `复测：${state.aiReviews.length}次`
  ].join(" · ");
}

function renderInputChecklist() {
  const items = [
    ["行业场景", Boolean(state.settings.industry)],
    ["模型采集", state.llmAnalyses.length > 0],
    ["来源平台", state.llmAnalyses.some((item) => (item.domains || []).length)],
    ["API Key", Boolean(state.apiConfig.apiKey)]
  ];
  return `<div class="check-list">${items.map(([label, ok]) => `<div class="${ok ? "ok" : ""}"><span>${ok ? "OK" : "缺"}</span>${label}</div>`).join("")}</div>`;
}

function getReadinessLabel() {
  const missing = [];
  if (!state.settings.industry) missing.push("行业场景");
  if (!state.llmAnalyses.length) missing.push("模型采集");
  if (!state.apiConfig.apiKey) missing.push("API Key");
  return missing.length ? `缺少：${missing.join("、")}` : "可以生成";
}

function renderReportCard(report, type) {
  const copyLabel = type === "draft" ? "复制文章" : type === "review" ? "复制复测" : "复制结果";
  const extraButton = type === "diagnosis"
    ? `<button class="small-button copy-button" data-copy="${escapeAttr(extractArticleTemplate(report.result))}">复制文章框架</button>`
    : "";
  return `
    <article class="record-card">
      <div class="item-meta">
        <span class="badge">${escapeHtml(report.model)}</span>
        <span>${escapeHtml(getProviderLabel(report.provider))}</span>
        <span>${formatDate(report.createdAt)}</span>
      </div>
      <pre class="record-preview">${escapeHtml(report.result.slice(0, 900))}${report.result.length > 900 ? "\n..." : ""}</pre>
      <div class="toolbar">
        <button class="small-button copy-button" data-copy="${escapeAttr(report.result)}">${copyLabel}</button>
        ${extraButton}
      </div>
    </article>
  `;
}

function renderCollectedSummary() {
  const latest = state.llmAnalyses[0];
  if (!latest) return renderEmpty("暂无采集数据。先在大模型页面点击 GEO START 采集一次。");
  const models = latest.productMatch?.recommended?.slice(0, 8).map((item) => item.model).join("、") || "未识别";
  const platforms = latest.productMatch?.platformPlan?.slice(0, 6).map((item) => item.platform).join("、") || "未识别";
  return `
    <div class="summary-box">
      <p><strong>最近识别型号：</strong>${escapeHtml(models)}</p>
      <p><strong>最近优先平台：</strong>${escapeHtml(platforms)}</p>
      <p><strong>最近来源域名：</strong>${escapeHtml((latest.domains || []).join("、") || "无显式来源")}</p>
    </div>
  `;
}

async function clearAllData() {
  if (!confirm("确认清空模型采集、文章样本、AI诊断、投放文章和复测记录？")) return;
  await chrome.runtime.sendMessage({ type: "clear-all-data" });
  await load();
}

function bindCopyButtons() {
  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyText(button.dataset.copy || "");
      flashButton(button, "已复制");
    });
  });
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function extractArticleTemplate(text) {
  const marker = "## 4.";
  const index = text.indexOf(marker);
  return index >= 0 ? text.slice(index).trim() : text;
}

function getProviderLabel(provider) {
  return PROVIDERS[provider]?.label || provider || "未设置";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function renderEmpty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function flashButton(button, text) {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => {
    button.textContent = old;
  }, 1200);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}
