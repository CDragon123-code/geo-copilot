const statusEl = document.getElementById("popupStatus");
const captureCountEl = document.getElementById("captureCount");
const analysisCountEl = document.getElementById("analysisCount");

document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("openPanel").addEventListener("click", async () => {
  await sendToActiveTab({ type: "open-panel" });
  window.close();
});

document.getElementById("captureArticle").addEventListener("click", async () => {
  statusEl.textContent = "正在分析并保存当前文章页";
  const result = await sendToActiveTab({ type: "capture-article" });
  statusEl.textContent = result && result.ok ? "已保存当前文章结构" : (result && result.error ? result.error : "当前页面暂时无法采集");
  await refreshCounts();
});

document.getElementById("captureLLM").addEventListener("click", async () => {
  statusEl.textContent = "正在分析并保存当前模型回答";
  const result = await sendToActiveTab({ type: "capture-llm" });
  statusEl.textContent = result && result.ok ? "已保存当前模型诊断" : (result && result.error ? result.error : "当前页面暂时无法分析");
  await refreshCounts();
});

document.getElementById("clearData").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "clear-all-data" });
  await sendToActiveTab({ type: "clear-current-analysis" }).catch(() => null);
  statusEl.textContent = "历史数据已清空";
  await refreshCounts();
});

refreshCounts();

async function refreshCounts() {
  const state = await chrome.storage.local.get(["captures", "llmAnalyses"]);
  captureCountEl.textContent = (state.captures || []).length;
  analysisCountEl.textContent = (state.llmAnalyses || []).length;
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const injected = await injectIntoTab(tab);
    if (!injected) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (secondError) {
      statusEl.textContent = getPageAccessHint(tab.url);
      return null;
    }
  }
}

async function injectIntoTab(tab) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["src/content.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/analyzer.js", "src/content.js"]
    });
    return true;
  } catch (error) {
    statusEl.textContent = getPageAccessHint(tab.url);
    return false;
  }
}

function getPageAccessHint(url = "") {
  if (url.startsWith("file://")) return "本地演示页需要在扩展详情里开启“允许访问文件网址”";
  if (/^chrome:|^edge:|^chrome-extension:/.test(url)) return "浏览器内部页面不允许扩展分析";
  return "页面权限受限，请刷新页面或重新加载扩展后再试";
}
