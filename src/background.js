const DEFAULT_SETTINGS = {
  companyName: "",
  industry: "",
  bannedClaims: "保证排名、百分百收录、绝对替代、夸大性能",
  tone: "专业、可信、清晰、可执行"
};

const DEFAULT_API_CONFIG = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  apiKey: "",
  temperature: 0.3
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([
    "settings",
    "captures",
    "llmAnalyses",
    "platformRules",
    "apiConfig",
    "aiReports",
    "aiDrafts",
    "aiReviews"
  ]);
  await chrome.storage.local.set({
    settings: sanitizeSettings(current.settings),
    captures: current.captures || [],
    llmAnalyses: current.llmAnalyses || [],
    platformRules: current.platformRules || {},
    apiConfig: { ...DEFAULT_API_CONFIG, ...(current.apiConfig || {}) },
    aiReports: current.aiReports || [],
    aiDrafts: current.aiDrafts || [],
    aiReviews: current.aiReviews || []
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "save-capture") {
    saveListItem("captures", message.payload).then(sendResponse);
    return true;
  }
  if (message.type === "save-llm-analysis") {
    saveListItem("llmAnalyses", message.payload).then(sendResponse);
    return true;
  }
  if (message.type === "save-api-config") {
    saveApiConfig(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === "run-ai-diagnosis") {
    runAiTask("aiReports", message.payload, "diagnosis").then(sendResponse);
    return true;
  }
  if (message.type === "run-ai-draft") {
    runAiTask("aiDrafts", message.payload, "draft").then(sendResponse);
    return true;
  }
  if (message.type === "run-ai-review") {
    runAiTask("aiReviews", message.payload, "review").then(sendResponse);
    return true;
  }
  if (message.type === "clear-all-data") {
    clearAllData().then(sendResponse);
    return true;
  }
  if (message.type === "get-state") {
    chrome.storage.local.get([
      "settings",
      "captures",
      "llmAnalyses",
      "platformRules",
      "apiConfig",
      "aiReports",
      "aiDrafts",
      "aiReviews"
    ]).then((state) => sendResponse({ ...state, settings: sanitizeSettings(state.settings) }));
    return true;
  }
  return false;
});

async function saveListItem(key, payload) {
  const current = await chrome.storage.local.get([key]);
  const list = current[key] || [];
  const item = { id: crypto.randomUUID(), ...payload };
  await chrome.storage.local.set({ [key]: [item, ...list].slice(0, 300) });
  return { ok: true, item };
}

async function saveApiConfig(payload) {
  const current = await chrome.storage.local.get(["apiConfig"]);
  const next = { ...DEFAULT_API_CONFIG, ...(current.apiConfig || {}), ...(payload || {}) };
  await chrome.storage.local.set({ apiConfig: next });
  return { ok: true, apiConfig: maskApiKey(next) };
}

async function runAiTask(storageKey, payload, taskType) {
  const stored = await chrome.storage.local.get(["apiConfig", storageKey]);
  const apiConfig = { ...DEFAULT_API_CONFIG, ...(stored.apiConfig || {}) };
  if (!apiConfig.apiKey) {
    return { ok: false, error: "请先在设置中填写 API Key。" };
  }

  try {
    const text = await callOpenAiCompatible(apiConfig, payload.prompt, taskType);
    const report = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      provider: apiConfig.provider,
      model: apiConfig.model,
      prompt: payload.prompt,
      input: payload.input || "",
      result: text
    };
    const list = stored[storageKey] || [];
    await chrome.storage.local.set({ [storageKey]: [report, ...list].slice(0, 50) });
    return { ok: true, report };
  } catch (error) {
    return { ok: false, error: error.message || "AI 调用失败，请检查接口配置。" };
  }
}

async function callOpenAiCompatible(apiConfig, prompt, taskType) {
  const endpoint = `${String(apiConfig.baseUrl || "").replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model,
      temperature: Number(apiConfig.temperature) || 0.3,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(taskType)
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `接口请求失败：${response.status}`;
    throw new Error(message);
  }
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
  if (!text) throw new Error("接口没有返回有效内容。");
  return text;
}

function getSystemPrompt(taskType) {
  if (taskType === "draft") {
    return "你是资深GEO内容编辑。你只输出可发布文章，不做空泛解释；必须区分产品型号、品牌、协议、封装、平台和插件状态词；不能虚构参数。";
  }
  if (taskType === "review") {
    return "你是GEO发布复测分析师。你只判断发布后的大模型推荐变化、引用来源变化、是否命中目标产品，并给出下一轮可执行优化动作。";
  }
  return "你是资深GEO优化顾问和B2B技术内容编辑。你只输出可执行结论和可发布内容；必须区分产品型号、品牌、协议、封装、平台和插件状态词；不要把START、READY、MQTT、STM32、SOT23-6等当作竞品或推荐型号，除非用户明确配置。";
}

async function clearAllData() {
  await chrome.storage.local.set({ captures: [], llmAnalyses: [], aiReports: [], aiDrafts: [], aiReviews: [] });
  return { ok: true };
}

function maskApiKey(config) {
  return {
    ...config,
    apiKey: config.apiKey ? "********" : ""
  };
}

function sanitizeSettings(settings = {}) {
  return {
    companyName: settings.companyName || "",
    industry: settings.industry || "",
    bannedClaims: settings.bannedClaims || DEFAULT_SETTINGS.bannedClaims,
    tone: settings.tone || DEFAULT_SETTINGS.tone
  };
}
