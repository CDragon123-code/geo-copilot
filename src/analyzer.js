(function () {
  const COMMON_WORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "what", "when", "how",
    "you", "your", "our", "are", "was", "were", "have", "has", "can", "will",
    "一个", "一种", "我们", "他们", "这些", "通过", "进行", "可以", "以及", "对于",
    "行业", "产品", "服务", "解决", "方案", "企业", "用户", "需要", "不同", "相关"
  ]);

  const PLATFORM_PRESETS = {
    "zhihu.com": { name: "知乎", kind: "content", titleLimit: 60, bodyLimit: 5000, authority: 86, style: "问答解释、选型经验、参数对比", requiredSections: ["选型背景", "关键参数", "型号对比", "应用建议", "FAQ"] },
    "baijiahao.baidu.com": { name: "百家号", kind: "content", titleLimit: 30, bodyLimit: 3000, authority: 84, style: "搜索友好、定义清楚、型号明确", requiredSections: ["定义", "参数表", "推荐型号", "应用场景", "资料来源"] },
    "weixin.qq.com": { name: "微信公众号", kind: "content", titleLimit: 64, bodyLimit: 6000, authority: 80, style: "体系化、品牌可信、工程案例", requiredSections: ["问题引入", "选型框架", "案例", "FAQ"] },
    "elecfans.com": { name: "电子发烧友", kind: "content", titleLimit: 42, bodyLimit: 3500, authority: 90, style: "电子工程师导向、参数和原理优先", requiredSections: ["芯片介绍", "典型应用", "参数对比", "电路/封装", "选型建议"] },
    "21ic.com": { name: "21ic", kind: "content", titleLimit: 42, bodyLimit: 3500, authority: 86, style: "工程技术社区、选型和方案导向", requiredSections: ["应用背景", "方案说明", "器件参数", "替代型号", "资料下载"] },
    "eeworld.com.cn": { name: "电子工程世界", kind: "content", titleLimit: 42, bodyLimit: 3500, authority: 86, style: "工程资讯、技术资料、应用方案", requiredSections: ["需求背景", "器件特点", "参考设计", "对比建议"] },
    "cnblogs.com": { name: "博客园", kind: "content", titleLimit: 50, bodyLimit: 5000, authority: 72, style: "技术笔记、可复现、长尾搜索", requiredSections: ["问题", "分析过程", "参数记录", "结论"] },
    "xiaohongshu.com": { name: "小红书", kind: "content", titleLimit: 20, bodyLimit: 1000, authority: 58, style: "场景化、清单式、强开头", requiredSections: ["痛点场景", "核心结论", "步骤清单"] },
    "toutiao.com": { name: "今日头条", kind: "content", titleLimit: 30, bodyLimit: 3000, authority: 68, style: "观点明确、段落短、适合科普", requiredSections: ["问题", "原因", "解决路径"] },
    "qwen.ai": { name: "通义千问", kind: "llm", style: "大模型回答页" },
    "chat.deepseek.com": { name: "DeepSeek", kind: "llm", style: "大模型回答页" },
    "deepseek.com": { name: "DeepSeek", kind: "llm", style: "大模型回答页" },
    "doubao.com": { name: "豆包", kind: "llm", style: "大模型回答页" },
    "kimi.moonshot.cn": { name: "Kimi", kind: "llm", style: "大模型回答页" },
    "yuanbao.tencent.com": { name: "腾讯元宝", kind: "llm", style: "大模型回答页" },
    "chatgpt.com": { name: "ChatGPT", kind: "llm", style: "大模型回答页" },
    "claude.ai": { name: "Claude", kind: "llm", style: "大模型回答页" }
  };

  const PRODUCT_QUERY_PATTERNS = [
    { pattern: /IR[-\s]?CUT|IRCUT/i, intent: "IR-CUT驱动芯片选型", scenario: "安防摄像头、日夜切换、双向线圈驱动" },
    { pattern: /安防|摄像头|camera|IPC|监控/i, intent: "安防摄像头马达驱动芯片", scenario: "摄像头模组、IR-CUT、对焦/光圈/云台小电机" },
    { pattern: /马达|电机|motor|driver/i, intent: "马达驱动芯片选型", scenario: "低压直流电机、步进电机、线圈驱动" }
  ];

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isVisible(node) {
    if (!node || !node.getBoundingClientRect) return false;
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function getHost(url) {
    try {
      return new URL(url || window.location.href).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function resolvePlatform(host) {
    const matched = Object.keys(PLATFORM_PRESETS).find((domain) => host.endsWith(domain));
    return matched ? PLATFORM_PRESETS[matched] : { name: host || "当前平台", kind: "content", titleLimit: 32, bodyLimit: 3000, authority: 62, style: "平台通用内容" };
  }

  function classifyPage(doc = document) {
    const host = getHost(doc.location && doc.location.href);
    const href = doc.location && doc.location.href ? doc.location.href : "";
    const title = cleanText(doc.title);
    if (/sample-llm\.html/i.test(href) || /大模型回答样例|模型回答样例/i.test(title)) {
      return {
        kind: "llm",
        host,
        platform: { name: "本地大模型演示", kind: "llm", style: "大模型回答页" },
        label: "大模型平台"
      };
    }
    const platform = resolvePlatform(host);
    if (platform.kind === "llm") {
      return { kind: "llm", host, platform, label: "大模型平台" };
    }
    return { kind: "content", host, platform, label: "官网/论坛/行业内容平台" };
  }

  function isLLMPlatform(urlOrHost = "") {
    const host = String(urlOrHost).includes("://") ? getHost(urlOrHost) : String(urlOrHost).replace(/^www\./, "");
    return resolvePlatform(host).kind === "llm";
  }

  function pickMainRoot(doc) {
    const candidates = ["article", "main", "[role='main']", ".article", ".content", ".post", ".entry", "#article", "#content"]
      .map((selector) => doc.querySelector(selector))
      .filter(Boolean);
    if (!candidates.length) return doc.body;
    return candidates
      .map((node) => ({ node, score: cleanText(node.innerText).length + node.querySelectorAll("h1,h2,h3,p,li,tr").length * 120 }))
      .sort((a, b) => b.score - a.score)[0].node;
  }

  function collectBlocks(root) {
    const blockSelectors = "h1,h2,h3,h4,p,li,blockquote,td,th";
    return Array.from(root.querySelectorAll(blockSelectors))
      .filter(isVisible)
      .filter((node) => !node.closest(".geo-copilot-root"))
      .map((node) => ({ tag: node.tagName.toLowerCase(), text: cleanText(node.innerText || node.textContent) }))
      .filter((block) => block.text.length >= (block.tag.startsWith("h") ? 3 : 10))
      .slice(0, 180);
  }

  function getMeta(doc, name) {
    const node = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return cleanText(node && node.getAttribute("content"));
  }

  function countWords(text) {
    const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const en = (text.match(/[A-Za-z0-9][A-Za-z0-9-]+/g) || []).length;
    return { cn, en, total: cn + en };
  }

  function getKeywords(text, limit = 14) {
    const normalized = cleanText(text).toLowerCase();
    const tokens = [];
    tokens.push(...(normalized.match(/[a-z0-9][a-z0-9-]{2,}/g) || []).filter((word) => !COMMON_WORDS.has(word)));

    const chinesePhrases = normalized.match(/[\u4e00-\u9fa5]{2,10}/g) || [];
    chinesePhrases.forEach((phrase) => {
      for (let size = 2; size <= Math.min(4, phrase.length); size += 1) {
        for (let index = 0; index <= phrase.length - size; index += 1) {
          const token = phrase.slice(index, index + size);
          if (!COMMON_WORDS.has(token)) tokens.push(token);
        }
      }
    });

    const counts = new Map();
    tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));
  }

  function inferStructure(blocks) {
    const headings = blocks.filter((block) => /^h[1-4]$/.test(block.tag));
    const paragraphs = blocks.filter((block) => !/^h[1-4]$/.test(block.tag));
    const text = blocks.map((block) => block.text).join("\n");
    const outline = headings.map((heading) => ({ level: Number(heading.tag.slice(1)), text: heading.text })).slice(0, 24);
    const listCount = blocks.filter((block) => block.tag === "li").length;
    const questionCount = (text.match(/[?？]/g) || []).length;
    const numberSignal = (text.match(/\d+|[一二三四五六七八九十]+、/g) || []).length;
    return {
      outline,
      opening: paragraphs[0] ? paragraphs[0].text : "",
      conclusion: paragraphs.length ? paragraphs[paragraphs.length - 1].text : "",
      paragraphCount: paragraphs.length,
      headingCount: headings.length,
      listCount,
      questionCount,
      numberSignal,
      pattern: inferPattern(outline, listCount, questionCount, numberSignal)
    };
  }

  function inferPattern(outline, listCount, questionCount, numberSignal) {
    if (questionCount >= 3) return "问答解释型";
    if (listCount >= 6 || numberSignal >= 8) return "清单步骤型";
    if (outline.some((item) => /型号|参数|选型|对比|替代/.test(item.text))) return "型号选型型";
    if (outline.some((item) => /案例|客户|实践|应用/.test(item.text))) return "案例拆解型";
    if (outline.some((item) => /对比|区别|选择|优劣/.test(item.text))) return "对比决策型";
    return "框架科普型";
  }

  function extractLinks(doc) {
    const links = Array.from(doc.querySelectorAll("a[href]"))
      .map((link) => ({ text: cleanText(link.innerText), href: link.href, host: getHost(link.href) }))
      .filter((link) => /^https?:/.test(link.href) && link.host && !link.href.startsWith(doc.location.origin))
      .slice(0, 100);
    const unique = new Map();
    links.forEach((link) => {
      if (!unique.has(link.href)) unique.set(link.href, link);
    });
    return Array.from(unique.values());
  }

  function splitProductSettings(settings = {}) {
    const products = Array.isArray(settings.products) ? settings.products : [];
    const fromFields = [
      settings.targetProduct,
      settings.productModel,
      settings.productModels,
      ...products
    ].filter(Boolean).join("\n");
    return extractModels(fromFields).map((model) => model.name);
  }

  function extractModels(text, allowedModels = []) {
    const source = cleanText(text);
    const modelPattern = /\b[A-Z]{1,6}[A-Z0-9]{1,8}(?:[-_/]?[A-Z0-9]{1,8}){0,3}\b/g;
    const allowSet = new Set((allowedModels || []).map((item) => String(item || "").replace(/[_/]/g, "-").toUpperCase()).filter(Boolean));
    const blacklist = new Set([
      "FAQ", "GEO", "SEO", "API", "URL", "HTML", "CSS", "JSON", "HTTP", "HTTPS",
      "PLC", "SCADA", "IOT", "IR-CUT", "IRCUT", "IPC", "ESD", "START", "READY",
      "MQTT", "HTTP", "UART", "SPI", "I2C", "PWM", "GPIO", "ADC", "DAC", "USB",
      "WIFI", "BLE", "CAN", "LIN", "TTL", "CMOS", "LDO", "DC", "AC", "LED"
    ]);
    const counts = new Map();
    let match;
    while ((match = modelPattern.exec(source))) {
      const name = match[0].replace(/[_/]/g, "-").toUpperCase();
      const isAllowed = allowSet.has(name);
      if (!isAllowed && (blacklist.has(name) || /^[0-9]+$/.test(name) || name.length < 4)) continue;
      if (!isAllowed && (isPackageName(name) || isProtocolOrPlatformName(name))) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }

  function isPackageName(name) {
    return /^(SOT|SOP|SSOP|TSSOP|MSOP|QFN|DFN|DIP|BGA|LQFP|TQFP|TO|SOD|WLCSP)[-]?[A-Z0-9]*[-]?\d*$/i.test(name);
  }

  function isProtocolOrPlatformName(name) {
    return /^(STM32|ESP32|ARDUINO|LINUX|ANDROID|RTOS|FREERTOS|MODBUS|OPCUA|TCP|UDP|RS232|RS485)$/i.test(name);
  }

  function inferQueryIntent(text) {
    const matched = PRODUCT_QUERY_PATTERNS.find((item) => item.pattern.test(text));
    if (matched) return matched;
    if (/选型|推荐|型号|替代|对比|芯片/.test(text)) return { intent: "产品选型/型号推荐", scenario: "围绕参数、应用场景和替代关系组织内容" };
    return { intent: "通用问题回答", scenario: "需要补充更明确的产品实体和场景词" };
  }

  function findContexts(text, model, radius = 90) {
    const contexts = [];
    const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    let match;
    while ((match = regex.exec(text)) && contexts.length < 5) {
      const start = Math.max(0, match.index - radius);
      const end = Math.min(text.length, match.index + model.length + radius);
      contexts.push(cleanText(text.slice(start, end)));
    }
    return contexts;
  }

  function detectReasons(contexts) {
    const joined = contexts.join("\n");
    const checks = [
      { key: "application", label: "应用场景明确", regex: /IR[-\s]?CUT|安防|摄像头|监控|camera|IPC|模组|电机|马达|线圈/i },
      { key: "parameters", label: "参数信息完整", regex: /电压|电流|功耗|封装|通道|H桥|输入|输出|工作温度|VCC|mA|A\b|V\b/i },
      { key: "comparison", label: "存在型号对比", regex: /对比|相比|替代|兼容|类似|推荐|优先|适合|区别/ },
      { key: "availability", label: "有资料或供应信息", regex: /datasheet|规格书|手册|库存|价格|供应|样品|下载|官网|代理/i },
      { key: "credibility", label: "有案例或来源背书", regex: /案例|方案|参考|来源|资料|实测|客户|量产|应用/ }
    ];
    return checks.filter((item) => item.regex.test(joined)).map((item) => item.label);
  }

  function analyzeProductMatching(answer, settings = {}) {
    const text = answer.text || "";
    const intent = inferQueryIntent(`${answer.title}\n${text}`);
    const ownModels = splitProductSettings(settings).map((item) => item.toUpperCase());
    const configuredCompetitors = (settings.competitorModels || []).map((item) => String(item || "").replace(/[_/]/g, "-").toUpperCase());
    const foundModels = extractModels(text, [...ownModels, ...configuredCompetitors]);
    const ownSet = new Set(ownModels);
    const recommended = foundModels.map((model, index) => {
      const contexts = findContexts(text, model.name);
      const sourceLinks = (answer.links || []).filter((link) => contexts.some((ctx) => ctx.includes(link.text)) || link.text.toUpperCase().includes(model.name));
      const reasons = detectReasons(contexts);
      const isMine = ownSet.has(model.name);
      const visibilityScore = Math.min(100, model.count * 24 + reasons.length * 12 + (sourceLinks.length ? 18 : 0) + Math.max(0, 18 - index * 3));
      return {
        model: model.name,
        mentions: model.count,
        isMine,
        rank: index + 1,
        visibilityScore,
        reasons,
        contexts,
        sourceLinks: sourceLinks.slice(0, 5)
      };
    });

    const ownMatches = recommended.filter((item) => item.isMine);
    const competitors = recommended.filter((item) => !item.isMine).slice(0, 8);
    const missingReasons = getMissingReasonLabels(ownMatches);
    const contentGaps = buildContentGaps(ownModels, ownMatches, competitors, intent, missingReasons);
    const platformPlan = buildPlatformPlan(answer, settings, competitors, intent, contentGaps);
    const prompt = buildProductOptimizationPrompt(answer, settings, intent, ownModels, competitors, platformPlan, contentGaps);

    return {
      intent,
      ownModels,
      recommended: recommended.slice(0, 16),
      competitors,
      ownMatches,
      missingReasons,
      contentGaps,
      platformPlan,
      prompt,
      score: scoreProductMatch(ownModels, ownMatches, contentGaps)
    };
  }

  function getMissingReasonLabels(ownMatches) {
    const expected = ["应用场景明确", "参数信息完整", "存在型号对比", "有资料或供应信息", "有案例或来源背书"];
    if (!ownMatches.length) return expected;
    const current = new Set(ownMatches.flatMap((item) => item.reasons));
    return expected.filter((item) => !current.has(item));
  }

  function buildContentGaps(ownModels, ownMatches, competitors, intent, missingReasons) {
    const gaps = [];
    if (!ownModels.length) gaps.push("当前未设置固定主推产品；请在GEO投放仿写中输入本次要推广的产品、参数和资料，AI会按本次输入生成内容。");
    if (ownModels.length && !ownMatches.length) gaps.push(`当前回答没有推荐你的型号（${ownModels.join("、")}），需要发布“${intent.intent}”相关内容，把型号与场景词绑定。`);
    if (competitors.length) gaps.push(`竞品/其它型号已被模型识别：${competitors.slice(0, 5).map((item) => item.model).join("、")}。需要做参数对比和替代关系内容。`);
    missingReasons.forEach((reason) => gaps.push(`补齐“${reason}”信息，增加模型引用时的推荐理由。`));
    gaps.push("页面中要同时出现：型号全称、应用场景、关键参数、替代/对比型号、规格书/资料链接、FAQ。");
    return gaps.slice(0, 8);
  }

  function buildPlatformPlan(answer, settings, competitors, intent, contentGaps) {
    const sourcePlatforms = getSourcePlatformSignals(answer, intent);
    const fallbackPlatforms = [
      { host: "elecfans.com", frequency: 0, relevance: 72, fromSource: false },
      { host: "21ic.com", frequency: 0, relevance: 70, fromSource: false },
      { host: "eeworld.com.cn", frequency: 0, relevance: 68, fromSource: false },
      { host: "baijiahao.baidu.com", frequency: 0, relevance: 56, fromSource: false },
      { host: "zhihu.com", frequency: 0, relevance: 54, fromSource: false },
      { host: "weixin.qq.com", frequency: 0, relevance: 52, fromSource: false },
      { host: "cnblogs.com", frequency: 0, relevance: 48, fromSource: false }
    ];
    const candidates = sourcePlatforms.length ? sourcePlatforms : fallbackPlatforms;
    return candidates.map((signal, index) => {
      const host = signal.host;
      const platform = resolvePlatform(host);
      const authority = platform.authority || 62;
      const sourceBoost = signal.fromSource ? 28 : 0;
      const frequencyBoost = Math.min(24, signal.frequency * 8);
      const relevanceBoost = Math.round(signal.relevance * 0.24);
      const score = Math.min(100, Math.round(authority * 0.46 + sourceBoost + frequencyBoost + relevanceBoost - index * 1.5));
      return {
        host,
        platform: platform.name,
        score,
        fromSource: signal.fromSource,
        sourceFrequency: signal.frequency,
        sourceRelevance: signal.relevance,
        reason: signal.fromSource
          ? `本次模型回答已引用/出现 ${signal.frequency} 次，相关度 ${signal.relevance}`
          : `未发现显式来源时的行业兜底：${platform.style}`,
        articleType: pickArticleType(host, intent, competitors),
        titleIdeas: buildTitleIdeas(platform.name, intent, settings, competitors),
        requiredInfo: platform.requiredSections || [],
        gapFocus: contentGaps.slice(0, 3)
      };
    }).sort((a, b) => b.score - a.score).slice(0, 6);
  }

  function getSourcePlatformSignals(answer, intent) {
    const signals = new Map();
    const intentText = `${intent.intent} ${intent.scenario}`;
    const links = answer.links || [];
    links.forEach((link) => {
      if (!link.host) return;
      const current = signals.get(link.host) || { host: link.host, frequency: 0, relevance: 0, fromSource: true };
      current.frequency += 1;
      current.relevance += scoreSourceRelevance(`${link.text} ${link.href}`, intentText);
      signals.set(link.host, current);
    });
    (answer.domains || []).forEach((host) => {
      if (!host) return;
      const current = signals.get(host) || { host, frequency: 0, relevance: 0, fromSource: true };
      current.frequency += 1;
      current.relevance += scoreSourceRelevance(host, intentText);
      signals.set(host, current);
    });
    return Array.from(signals.values())
      .map((signal) => ({
        ...signal,
        relevance: Math.min(100, Math.round(signal.relevance / Math.max(1, signal.frequency)))
      }))
      .filter((signal) => !/deepseek|qwen|doubao|chatgpt|openai|kimi|yuanbao/i.test(signal.host));
  }

  function scoreSourceRelevance(sourceText, intentText) {
    const text = `${sourceText} ${intentText}`;
    let score = 34;
    if (/elecfans|21ic|eeworld|ednchina|datasheet|ti\.com|analog|onsemi|st|nxp|microchip|mouser|digikey/i.test(text)) score += 26;
    if (/芯片|驱动|IR[-\s]?CUT|马达|电机|camera|摄像头|安防|型号|选型|参数|datasheet|规格书/i.test(text)) score += 24;
    if (/论坛|社区|博客|问答|百科|百家号|知乎|公众号|weixin/i.test(text)) score += 10;
    if (/广告|登录|搜索|首页|视频|图片/i.test(text)) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  function pickArticleType(host, intent, competitors) {
    if (/elecfans|21ic|eeworld/.test(host)) return competitors.length ? "参数对比 + 选型指南" : "芯片方案介绍 + 典型应用";
    if (/baijiahao|zhihu/.test(host)) return "搜索问答 + 型号推荐清单";
    if (/weixin/.test(host)) return "品牌技术文章 + 应用案例";
    return "长尾技术笔记";
  }

  function buildTitleIdeas(platformName, intent, settings, competitors) {
    const product = splitProductSettings(settings)[0] || "本次主推产品";
    const comp = competitors[0]?.model || "常见对比对象";
    return [
      `${intent.intent}怎么选？${product}与${comp}参数对比`,
      `${settings.industry || "目标行业"}场景下的${product}应用与选型要点`,
      `${product}适合哪些应用场景？一篇讲清楚`
    ].map((title) => `${platformName}：${title}`);
  }

  function buildProductOptimizationPrompt(answer, settings, intent, ownModels, competitors, platformPlan, contentGaps) {
    const product = ownModels[0] || "本次投放内容中的主推产品";
    return [
      "你是一名B2B行业 GEO 内容策略编辑。",
      `目标问题：${intent.intent}`,
      `目标场景：${intent.scenario}`,
      `主推对象：${product}`,
      `公司/品牌：${settings.companyName || "我的公司"}`,
      "本阶段不固定产品资料；具体型号、参数、对比对象和资料链接应由用户在GEO投放仿写中输入。",
      "",
      `模型当前推荐/识别的其它型号：${competitors.slice(0, 8).map((item) => item.model).join("、") || "暂未识别"}`,
      "",
      "请生成一个 GEO 发布方案：",
      "1. 先列出大模型为什么会推荐这些型号。",
      "2. 对比主推型号与竞品/其它型号，给出不夸大的差异化表达。",
      "3. 为每个平台生成标题、大纲、必备参数表、FAQ 和资料链接位置。",
      "4. 输出 3 篇可直接发布的文章结构：工程师选型、参数对比、应用案例。",
      "5. 避免保证排名、夸大性能、无法验证的替代承诺。",
      "",
      "优先平台：",
      ...platformPlan.map((item, index) => `${index + 1}. ${item.platform}：${item.articleType}，原因：${item.reason}`),
      "",
      "当前内容缺口：",
      ...contentGaps.map((gap, index) => `${index + 1}. ${gap}`)
    ].join("\n");
  }

  function scoreProductMatch(ownModels, ownMatches, gaps) {
    if (!ownModels.length) return 35;
    if (!ownMatches.length) return Math.max(20, 58 - gaps.length * 4);
    const best = Math.max(...ownMatches.map((item) => item.visibilityScore));
    return Math.min(100, best + ownMatches.length * 8);
  }

  function analyzePlatformFit(article, settings) {
    const platform = resolvePlatform(article.host);
    const titleLength = countWords(article.title).total;
    const titleScore = platform.titleLimit ? Math.max(0, 100 - Math.abs(titleLength - platform.titleLimit * 0.8) * 3) : 80;
    const structureScore = Math.min(100, article.structure.headingCount * 12 + article.structure.paragraphCount * 3 + article.structure.listCount * 4);
    const keywordScore = Math.min(100, article.keywords.length * 8);
    const companyTerms = [settings.companyName, settings.industry, ...(settings.products || [])].filter(Boolean);
    const relevanceHits = companyTerms.filter((term) => article.text.includes(term)).length;
    const relevanceScore = companyTerms.length ? Math.min(100, relevanceHits / companyTerms.length * 100) : 55;
    return {
      score: Math.round(titleScore * 0.2 + structureScore * 0.35 + keywordScore * 0.2 + relevanceScore * 0.25),
      titleScore: Math.round(titleScore),
      structureScore: Math.round(structureScore),
      keywordScore: Math.round(keywordScore),
      relevanceScore: Math.round(relevanceScore),
      platform
    };
  }

  function analyzeArticle(doc = document, settings = {}) {
    const host = getHost(doc.location && doc.location.href);
    const pageKind = classifyPage(doc);
    const root = pickMainRoot(doc);
    const blocks = collectBlocks(root);
    const title = cleanText(doc.querySelector("h1")?.innerText || doc.title);
    const text = cleanText(blocks.map((block) => block.text).join("\n"));
    const article = {
      type: "article",
      capturedAt: new Date().toISOString(),
      url: doc.location.href,
      host,
      pageKind: pageKind.kind,
      platform: resolvePlatform(host),
      title,
      metaDescription: getMeta(doc, "description") || getMeta(doc, "og:description"),
      canonical: doc.querySelector("link[rel='canonical']")?.href || doc.location.href,
      text,
      blocks,
      keywords: getKeywords(text),
      wordCount: countWords(text),
      structure: inferStructure(blocks),
      productModels: extractModels(text)
    };
    article.platformFit = analyzePlatformFit(article, settings);
    article.recommendations = buildArticleRecommendations(article, settings);
    return article;
  }

  function buildArticleRecommendations(article, settings) {
    const tips = [];
    if (article.structure.headingCount < 3) tips.push("增加 3-5 个二级标题，让平台和大模型更容易识别内容层级。");
    if (!/型号|参数|选型|对比|封装|规格书/.test(article.text)) tips.push("补充型号、关键参数、封装、规格书和对比信息，增强产品实体识别。");
    if (article.keywords.length < 6) tips.push("补充行业关键词、产品场景词和用户问题词，形成可被引用的语义簇。");
    if (settings.companyName && !article.text.includes(settings.companyName)) tips.push(`在案例或方案段落中自然出现“${settings.companyName}”，避免只写通用科普。`);
    if (!/数据|案例|来源|报告|调研|客户|实践|规格书|datasheet/i.test(article.text)) tips.push("加入规格书、参数表、案例或来源说明，提升大模型引用时的可信度。");
    return tips.slice(0, 5);
  }

  function analyzeLLMAnswer(doc = document, settings = {}) {
    const host = getHost(doc.location && doc.location.href);
    const pageKind = classifyPage(doc);
    const root = pickMainRoot(doc);
    const text = cleanText((root.innerText || doc.body.innerText).replace(/\b(GEO START|READY|STOP|清理当前|清空历史)\b/g, ""));
    const links = extractLinks(doc);
    const domains = Array.from(new Set(links.map((link) => link.host))).slice(0, 16);
    const companyTerms = [settings.companyName, settings.industry, ...(settings.products || [])].filter(Boolean);
    const entityHits = companyTerms.filter((term) => term && text.includes(term));
    const answer = {
      type: "llm-answer",
      capturedAt: new Date().toISOString(),
      url: doc.location.href,
      host,
      pageKind: pageKind.kind,
      platform: resolvePlatform(host),
      title: cleanText(doc.title),
      text: text.slice(0, 16000),
      wordCount: countWords(text),
      links,
      domains,
      sourceKeywords: getKeywords(links.map((link) => `${link.text} ${link.host}`).join("\n"), 10),
      keywords: getKeywords(text),
      answerPattern: inferLLMPattern(text),
      entityHits
    };
    answer.geoFit = analyzeGeoFit(answer, settings);
    answer.productMatch = analyzeProductMatching(answer, settings);
    answer.recommendations = buildLLMRecommendations(answer, settings);
    return answer;
  }

  function inferLLMPattern(text) {
    if (/来源|引用|参考|根据|资料/.test(text) && /http|www|\.com|\.cn/.test(text)) return "带来源引用";
    if (/型号|参数|选型|推荐|替代|对比/.test(text)) return "型号选型推荐";
    if (/步骤|第一|第二|第三|清单|建议/.test(text)) return "步骤建议型";
    if (/对比|区别|优点|缺点|适合/.test(text)) return "对比决策型";
    if (/是什么|定义|指的是|概念/.test(text)) return "定义科普型";
    return "综合回答型";
  }

  function analyzeGeoFit(answer, settings) {
    const hasSources = answer.links.length > 0;
    const companyTerms = [settings.companyName, settings.industry, ...(settings.products || [])].filter(Boolean);
    const entityScore = companyTerms.length ? Math.min(100, answer.entityHits.length / companyTerms.length * 100) : 45;
    const sourceScore = Math.min(100, answer.domains.length * 14 + (hasSources ? 20 : 0));
    const structureScore = /步骤|对比|定义|来源|型号|选型/.test(answer.answerPattern) ? 82 : 58;
    const keywordScore = Math.min(100, answer.keywords.length * 7);
    return {
      score: Math.round(entityScore * 0.3 + sourceScore * 0.3 + structureScore * 0.2 + keywordScore * 0.2),
      entityScore: Math.round(entityScore),
      sourceScore: Math.round(sourceScore),
      structureScore,
      keywordScore: Math.round(keywordScore)
    };
  }

  function buildLLMRecommendations(answer, settings) {
    const tips = [];
    const match = answer.productMatch;
    if (match && match.ownModels.length && !match.ownMatches.length) tips.push(`模型没有推荐你的型号（${match.ownModels.join("、")}），优先发布选型对比和应用场景内容。`);
    if (match && match.competitors.length) tips.push(`围绕 ${match.competitors.slice(0, 4).map((item) => item.model).join("、")} 做参数对比和替代关系说明。`);
    if (answer.domains.length) tips.push(`重点学习这些被引用域名的内容形态：${answer.domains.slice(0, 5).join("、")}。`);
    if (!answer.links.length) tips.push("回答没有显式来源，优化时更要把标题、首段定义、FAQ 和结构化小标题写清楚。");
    if (settings.industry) tips.push(`围绕“${settings.industry} + 选型/参数/替代/价格/规格书/应用”扩展内容矩阵。`);
    return tips.slice(0, 5);
  }

  function createImitationPackage(article, settings = {}, platformRule = {}) {
    const platform = { ...article.platform, ...platformRule };
    const products = (settings.products || []).join("、") || "本次投放内容";
    const keywords = article.keywords.map((item) => item.term).slice(0, 10).join("、");
    const outline = article.structure.outline.length
      ? article.structure.outline.map((item) => `${"#".repeat(Math.min(item.level, 3))} ${item.text}`).join("\n")
      : "## 痛点背景\n## 关键参数\n## 型号对比\n## 应用案例\n## FAQ";
    const prompt = [
      "你是一名 GEO 内容策略编辑。请参考下面的成功文章结构，但不要照抄原文表达。",
      `公司：${settings.companyName || "我的公司"}`,
      `行业：${settings.industry || "目标行业"}`,
      `投放对象：${products}`,
      `目标平台：${platform.name || article.host}`,
      `平台风格：${platform.style || "信息密度高、结构清晰"}`,
      `标题长度建议：${platform.titleLimit || 32} 字以内`,
      `参考文章标题：${article.title}`,
      `参考结构类型：${article.structure.pattern}`,
      `高频主题词：${keywords || "请从参考文章中提炼"}`,
      "",
      "请输出：",
      "1. 5 个适合该平台的标题。",
      "2. 一篇原创文章正文，保留参考文章的结构节奏，但换成我的行业、产品和案例。",
      "3. 加入型号、参数表、应用场景、替代/对比型号、资料来源和 FAQ。",
      "4. 给出可引用来源、数据或案例应该补在哪里。",
      "",
      "参考文章结构：",
      outline,
      "",
      "品牌要求：",
      settings.valueProps || "具体产品、参数、案例和资料链接请在GEO投放仿写中输入；输出需专业、可信、可落地，不夸大承诺。",
      settings.bannedClaims ? `避免表达：${settings.bannedClaims}` : "避免绝对化、保证排名等表述。"
    ].join("\n");

    const draft = [
      `标题方向：${settings.industry || "行业"}场景下，${products}如何解决核心选型问题`,
      "",
      "开头：先用用户正在遇到的具体选型问题切入，用一句话给出结论。",
      "",
      outline.split("\n").map((line) => line.replace(/^#+\s*/, "## ")).join("\n\n"),
      "",
      "FAQ：",
      `Q1：${settings.companyName || "品牌"}适合哪些使用场景？`,
      "Q2：选择这类方案时应该看哪些参数？",
      "Q3：和其它型号相比，优势和限制分别是什么？"
    ].join("\n");

    return { prompt, draft, platform };
  }

  window.GeoCopilotAnalyzer = {
    PLATFORM_PRESETS,
    cleanText,
    analyzeArticle,
    analyzeLLMAnswer,
    analyzeProductMatching,
    createImitationPackage,
    classifyPage,
    isLLMPlatform,
    getHost,
    resolvePlatform,
    extractModels
  };
})();
