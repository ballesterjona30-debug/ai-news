const RssParser = require("rss-parser");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { translate: googleTranslate } = require("@vitalets/google-translate-api");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ======= CONFIG =======
const PROXY = "http://127.0.0.1:33210";
const proxyAgent = new HttpsProxyAgent(PROXY);
const fetchWithProxy = (url, opts = {}) => fetch(url, { ...opts, agent: proxyAgent, signal: AbortSignal.timeout(15000) });

const parser = new RssParser({
  timeout: 15000,
  headers: { "User-Agent": "AI-News-Aggregator/1.0" },
  customFields: { item: ["media:content", "media:thumbnail", "enclosure", "content:encoded"] },
});

const SOURCES = [
  { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", lang: "en", weight: 1.2 },
  { name: "MIT科技评论", url: "https://www.technologyreview.com/feed/", lang: "en", weight: 1.0 },
  { name: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/", lang: "en", weight: 0.9 },
  { name: "量子位", url: "https://www.qbitai.com/feed", lang: "zh", weight: 1.3 },
  { name: "机器之心", url: "https://www.jiqizhixin.com/rss", lang: "zh", weight: 1.1 },
];

const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "deep learning", "llm",
  "gpt", "chatgpt", "openai", "anthropic", "claude", "gemini", "copilot",
  "neural network", "transformer", "diffusion", "stable diffusion",
  "robot", "automation", "autonomous", "chip", "gpu", "nvidia", "semiconductor",
  "data center", "compute", "training", "inference",
  "generative", "agent", "agi", "embedding", "rag",
  "人工智能", "大模型", "深度学习", "机器学习", "智能体",
  "openai", "谷歌", "微软", "meta", "英伟达", "算力", "芯片",
];

const MODEL_KEYWORDS = [
  { kw: "gpt", tag: "GPT" }, { kw: "chatgpt", tag: "ChatGPT" },
  { kw: "claude", tag: "Claude" }, { kw: "anthropic", tag: "Claude" },
  { kw: "gemini", tag: "Gemini" }, { kw: "deepmind", tag: "Gemini" },
  { kw: "llama", tag: "Llama" }, { kw: "meta ai", tag: "Llama" },
  { kw: "grok", tag: "Grok" }, { kw: "xai", tag: "Grok" },
  { kw: "mistral", tag: "Mistral" },
  { kw: "deepseek", tag: "DeepSeek" }, { kw: "深度求索", tag: "DeepSeek" },
  { kw: "通义千问", tag: "通义千问" }, { kw: "qwen", tag: "Qwen" },
  { kw: "文心一言", tag: "文心一言" }, { kw: "ernie", tag: "文心一言" }, { kw: "百度文心", tag: "文心一言" },
  { kw: "kimi", tag: "Kimi" }, { kw: "月之暗面", tag: "Kimi" },
  { kw: "豆包", tag: "豆包" }, { kw: "doubao", tag: "豆包" },
  { kw: "minimax", tag: "MiniMax" }, { kw: "海螺ai", tag: "MiniMax" },
  { kw: "智谱", tag: "智谱GLM" }, { kw: "chatglm", tag: "智谱GLM" }, { kw: "glm", tag: "智谱GLM" },
  { kw: "百川", tag: "百川" },
  { kw: "零一万物", tag: "零一万物" },
  { kw: "讯飞星火", tag: "讯飞星火" }, { kw: "星火大模型", tag: "讯飞星火" }, { kw: "科大讯飞", tag: "讯飞星火" },
  { kw: "商汤", tag: "商汤日日新" },
  { kw: "腾讯混元", tag: "腾讯混元" }, { kw: "混元", tag: "腾讯混元" },
  { kw: "昆仑万维", tag: "昆仑万维" }, { kw: "天工ai", tag: "昆仑万维" },
  { kw: "阶跃星辰", tag: "阶跃星辰" },
  { kw: "面壁智能", tag: "面壁智能" }, { kw: "minicpm", tag: "面壁智能" },
  { kw: "sora", tag: "Sora" }, { kw: "midjourney", tag: "Midjourney" },
  { kw: "runway", tag: "Runway" }, { kw: "stability", tag: "Stability" },
  { kw: "perplexity", tag: "Perplexity" }, { kw: "cursor", tag: "Cursor" },
  { kw: "copilot", tag: "Copilot" }, { kw: "cowork", tag: "Cowork" },
  { kw: "nous", tag: "Nous" }, { kw: "cohere", tag: "Cohere" },
  { kw: "hugging face", tag: "HuggingFace" },
];

const HOT_TOPICS = [
  { kw: "openai", score: 5 }, { kw: "chatgpt", score: 5 }, { kw: "gpt-5", score: 5 },
  { kw: "nvidia", score: 4 }, { kw: "黄仁勋", score: 4 }, { kw: "英伟达", score: 4 },
  { kw: "claude", score: 3 }, { kw: "anthropic", score: 3 },
  { kw: "gemini", score: 3 }, { kw: "google", score: 3 }, { kw: "谷歌", score: 3 },
  { kw: "agent", score: 3 }, { kw: "智能体", score: 3 },
  { kw: "agi", score: 4 }, { kw: "通用人工智能", score: 4 },
  { kw: "robot", score: 3 }, { kw: "机器人", score: 3 }, { kw: "具身", score: 3 },
  { kw: "马斯克", score: 4 }, { kw: "musk", score: 4 }, { kw: "xai", score: 3 },
  { kw: "芯片", score: 3 }, { kw: "gpu", score: 3 }, { kw: "算力", score: 3 },
  { kw: "大模型", score: 3 }, { kw: "deepseek", score: 4 },
];

// ======= TRANSLATION (Google via proxy with retry + direct fallback) =======
async function translateText(text) {
  if (!text || text.length < 5) return text;

  // Attempt 1: Google via proxy (primary)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await googleTranslate(text, {
        from: "en",
        to: "zh-CN",
        fetchOptions: { agent: proxyAgent },
      });
      if (result.text && result.text !== text) return result.text;
    } catch {}
    if (attempt < 2) await delay(1000 * (attempt + 1)); // backoff: 1s, 2s
  }

  // Attempt 2: Google directly (no proxy, might work intermittently)
  try {
    const result = await googleTranslate(text, { from: "en", to: "zh-CN" });
    if (result.text && result.text !== text) return result.text;
  } catch {}

  // Attempt 3: MyMemory (rate-limited but sometimes available)
  try {
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=en|zh-CN";
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const t = data?.responseData?.translatedText || "";
    if (t && !t.includes("MYMEMORY WARNING") && !t.includes("QUOTA")) return t;
  } catch {}

  return text;
}

// ======= IMAGE EXTRACTION =======
function extractImage(item) {
  if (item["media:content"]?.$?.url) return item["media:content"].$.url;
  if (item["media:content"]?.url) return item["media:content"].url;
  if (item["media:thumbnail"]?.$?.url) return item["media:thumbnail"].$.url;
  if (item.enclosure?.url) return item.enclosure.url;
  const content = item["content:encoded"] || item.content || "";
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  return "";
}

async function fetchArticleData(url) {
  try {
    const res = await fetchWithProxy(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    // og:image
    let image = "";
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og) image = og[1];
    else {
      const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (tw) image = tw[1];
      else {
        const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (img) image = img[1];
      }
    }
    // 提取正文文本用于模型匹配（去掉标签，取前2000字符）
    const bodyText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
    return { image, bodyText };
  } catch {}
  return { image: "", bodyText: "" };
}

// ======= HELPERS =======
function matchModels(title, summary) {
  const text = ((title || "") + " " + (summary || "")).toLowerCase();
  const tags = new Set();
  for (const m of MODEL_KEYWORDS) {
    if (text.includes(m.kw.toLowerCase())) tags.add(m.tag);
  }
  return [...tags];
}

function calcHotScore(title, summary, sourceWeight, dateStr) {
  const now = Date.now();
  const hours = (now - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  let recencyScore = 0;
  if (hours <= 24) recencyScore = 50 - (hours / 24) * 20;
  else if (hours <= 72) recencyScore = 30 - ((hours - 24) / 48) * 20;
  else if (hours <= 168) recencyScore = 10 - ((hours - 72) / 96) * 10;
  const sourceScore = sourceWeight * 10;
  const text = ((title || "") + " " + (summary || "")).toLowerCase();
  let topicScore = 0;
  for (const t of HOT_TOPICS) { if (text.includes(t.kw.toLowerCase())) topicScore += t.score; }
  topicScore = Math.min(topicScore, 25);
  let qualityScore = 0;
  const len = (title || "").length;
  if (len >= 15 && len <= 60) qualityScore = 8;
  else if (len > 60 && len <= 100) qualityScore = 5;
  else if (len > 10) qualityScore = 3;
  return Math.min(Math.round(recencyScore + sourceScore + topicScore + qualityScore), 100);
}

function isAIArticle(title, summary) {
  const text = (title + " " + (summary || "")).toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function summarize(html) {
  if (!html) return "";
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= 200) return text;
  return text.slice(0, 200).replace(/\s\S*$/, "") + "…";
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9一-鿿]/g, "");
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ======= RSS FETCH =======
async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = [];
    for (const item of feed.items) {
      const title = item.title?.trim() || "";
      const summary = summarize(item.contentSnippet || item.content || item.summary);
      if (!title) continue;
      items.push({
        title, summary,
        link: item.link?.trim() || "",
        source: source.name, weight: source.weight,
        date: item.pubDate || item.isoDate || new Date().toISOString(),
        needsTranslate: source.lang === "en",
        image: extractImage(item),
      });
    }
    console.log(`  [OK] ${source.name}: ${items.length} 篇`);
    return items;
  } catch (err) {
    console.error(`  [SKIP] ${source.name}: ${err.message}`);
    return [];
  }
}

// ======= BILIBILI (热门榜大量爬取 + AI精准筛选) =======
async function fetchBilibili() {
  console.log("  获取B站AI相关视频(热门榜×10页)…");
  const allVideos = [];
  const seen = new Set();
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.bilibili.com/c/ai/",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };

  for (let page = 1; page <= 10; page++) {
    try {
      const url = `https://api.bilibili.com/x/web-interface/popular?ps=50&pn=${page}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.code !== 0 || !data.data?.list) continue;

      for (const v of data.data.list) {
        if (seen.has(v.aid)) continue;
        seen.add(v.aid);

        const title = (v.title || ""), desc = (v.desc || "").slice(0, 200);
        const text = (title + " " + desc).toLowerCase();

        // 严格AI匹配
        const aiMatch = ["人工智能", "大模型", "gpt", "openai", "deepseek", "chatgpt", "claude",
          "gemini", "llm", "ai工具", "ai开发", "ai编程", "ai融资", "ai芯片", "模型训练",
          "具身智能", "智能体", "agent", "ai行业", "机器人", "自动驾驶", "英伟达", "nvidia",
          "机器学习", "深度学习", "ai搜索", "ai视频", "ai绘画", "ai写作"];
        if (!aiMatch.some(t => text.includes(t))) continue;

        // 排除非AI
        if (/漫剧|鬼畜|翻唱|恶仙|瓜梦|游戏实况|kpop|饭拍|直拍|舞蹈|应援|生日|节日|妈妈.*快乐|扫地|驾控/i.test(text)) continue;
        if (["搞笑","鬼畜","娱乐","音乐","舞蹈","生活","美食","时尚","动物","汽车","居家","运动"].includes(v.tname)) continue;

        // 近两周
        const age = (Date.now()/1000) - (v.pubdate || 0);
        if (age > 14 * 86400) continue;

        allVideos.push({
          id: "hot_" + v.aid, title, desc: desc.slice(0, 120),
          link: v.short_link_v2 || `https://www.bilibili.com/video/${v.bvid}`,
          image: v.pic || "", author: v.owner?.name || "",
          views: v.stat?.view || 0, platform: "B站", type: "video",
        });
      }
      await delay(200);
    } catch (e) {
      console.error(`    B站p${page}失败: ${e.message}`);
    }
  }

  allVideos.sort((a, b) => b.views - a.views);
  console.log(`  [OK] B站: ${allVideos.length} 个视频`);
  return allVideos;
}

// ======= DOUYIN (热搜 + 精细化) =======
async function fetchDouyin() {
  console.log("  获取抖音AI热搜…");
  const items = [];
  // AI相关的热搜关键词
  const aiTerms = ["ai", "人工智能", "gpt", "大模型", "openai", "deepseek", "机器人", "芯片",
    "英伟达", "claude", "chatgpt", "gemini", "模型", "智能", "算力", "自动驾驶", "编程ai",
    "ai工具", "ai绘画", "ai视频", "ai写作", "ai搜索", "ai编程", "aigc", "机器学习"];
  try {
    const res = await fetch("https://www.douyin.com/aweme/v1/web/hot/search/list/?detail_list=1&count=30", {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Referer": "https://www.douyin.com" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (text.startsWith("{")) {
      const data = JSON.parse(text);
      for (const w of data?.data?.word_list || []) {
        const title = (w.word || "").trim();
        if (!title) continue;
        const lower = title.toLowerCase();
        if (!aiTerms.some(t => lower.includes(t))) continue;
        items.push({
          id: "dy_" + crypto.randomUUID(),
          title: "🔥 " + title,
          desc: `抖音实时热搜 · 热度值: ${w.hot_value || "N/A"} · 点击搜索相关视频`,
          link: `https://www.douyin.com/search/${encodeURIComponent(title)}?type=video`,
          image: "",
          author: "抖音热搜榜",
          views: w.hot_value || 0,
          platform: "抖音",
          type: "video",
        });
      }
    }
  } catch (e) {
    console.error("    抖音失败:", e.message);
  }
  console.log(`  [OK] 抖音: ${items.length} 条热搜`);
  return items;
}

// ======= X (Nitter RSS — limited availability) =======
// Note: Nitter instances are often unreachable from CN proxies.
// If you have an X API v2 Bearer Token, set X_BEARER_TOKEN in env and
// uncomment the X_API_ACCOUNTS path below.
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || "";

// Fetch RSS via proxy and parse with rss-parser
async function fetchRSSViaProxy(url) {
  try {
    const res = await fetchWithProxy(url);
    if (!res.ok) return null;
    const xml = await res.text();
    return await parser.parseString(xml);
  } catch { return null; }
}

async function fetchX() {
  console.log("  尝试X…");

  // --- Path A: X API v2 (if token available) ---
  if (X_BEARER_TOKEN) {
    console.log("    X API v2 mode…");
    const accounts = [
      "OpenAI", "AnthropicAI", "GoogleDeepMind", "DeepSeekAI",
      "nvidia", "MistralAI", "Cohere", "sama", "ylecun",
    ];
    const items = [];
    const seen = new Set();
    for (const username of accounts) {
      try {
        const url = `https://api.x.com/2/tweets/search/recent?query=from:${username}&max_results=5&tweet.fields=created_at,public_metrics`;
        const res = await fetchWithProxy(url, {
          headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
        });
        const data = await res.json();
        for (const tw of data?.data || []) {
          const key = tw.id;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            id: "x_" + tw.id,
            title: tw.text.slice(0, 120),
            desc: "",
            link: `https://x.com/${username}/status/${tw.id}`,
            image: "",
            author: `@${username}`,
            views: tw.public_metrics?.like_count || 0,
            platform: "X",
            type: "post",
          });
        }
      } catch {}
      await delay(300);
    }
    console.log(`  [OK] X: ${items.length} 条 (API)`);
    return items;
  }

  // --- Path B: Nitter RSS (quick attempt) ---
  console.log("    Nitter RSS模式…");
  const items = [];
  const seen = new Set();
  const instances = [
    "https://nitter.poast.org",
    "https://xcancel.com",
    "https://nitter.privacyredirect.com",
  ];

  // Try searching on first instance only (fast)
  for (const instance of instances.slice(0, 2)) {
    for (const q of ["AI", "OpenAI", "LLM"]) {
      const feed = await fetchRSSViaProxy(`${instance}/search/rss?q=${encodeURIComponent(q)}`);
      if (feed?.items) {
        for (const item of feed.items.slice(0, 10)) {
          const key = (item.title || "").slice(0, 60);
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              id: "x_" + crypto.randomUUID(),
              title: item.title || "",
              desc: summarize(item.contentSnippet || item.content || ""),
              link: item.link || "",
              image: "",
              author: item.creator || "X",
              views: 0,
              platform: "X",
              type: "post",
            });
          }
        }
      }
      if (items.length >= 10) break;
      await delay(300);
    }
    if (items.length >= 10) break;
  }

  console.log(`  [OK] X: ${items.length} 条${items.length === 0 ? ' (Nitter不可达,可设X_BEARER_TOKEN开启API模式)' : ''}`);
  return items.slice(0, 15);
}

// ======= MAIN =======
function stripItem(item) {
  return {
    title: item.title, summary: item.summary, link: item.link,
    source: item.source, date: item.date,
    hotScore: item.hotScore, models: item.models || [],
    image: item.image || "",
  };
}

async function main() {
  console.log("=== 抓取 AI 新闻 ===\n");

  const promises = SOURCES.map((s) => fetchFeed(s));
  const results = await Promise.all(promises);
  let all = results.flat();

  const seen = new Set();
  for (let i = all.length - 1; i >= 0; i--) {
    const key = normalizeTitle(all[i].title).slice(0, 40);
    if (seen.has(key)) { all.splice(i, 1); } else { seen.add(key); }
  }

  const filtered = all.filter((item) => isAIArticle(item.title, item.summary));
  console.log(`\n过滤后 ${filtered.length} 篇`);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = filtered.slice(0, 50);

  // 翻译前先匹配模型关键词（英文原文）
  console.log("\n模型标签匹配(原文)…");
  for (const item of latest) {
    item.models = matchModels(item.title, item.summary);
  }

  // 翻译
  console.log("\n翻译(Google via proxy)…");
  for (let i = 0; i < latest.length; i++) {
    if (latest[i].needsTranslate) {
      const origTitle = latest[i].title, origSummary = latest[i].summary;
      latest[i].title = await translateText(latest[i].title);
      await delay(600); // longer delay to avoid rate limit
      latest[i].summary = await translateText(latest[i].summary);
      const changed = latest[i].title !== origTitle || latest[i].summary !== origSummary;
      if (i % 5 === 0) console.log(`  翻译 [${i+1}/${latest.length}]${changed ? '' : ' ⚠部分失败'}…`);
      await delay(600);
    }
  }

  // 翻译后再匹配一次（中文关键词）
  console.log("\n模型标签补充(译文)…");
  for (const item of latest) {
    const extraModels = matchModels(item.title, item.summary);
    // 合并去重
    const combined = new Set([...(item.models || []), ...extraModels]);
    item.models = [...combined];
  }

  // 抓取文章图片 + 正文（用于模型匹配）
  console.log("\n抓取文章图片和正文…");
  let imgFetched = 0, bodyFetched = 0;
  for (const item of latest) {
    if (!item.image && item.link) {
      const { image, bodyText } = await fetchArticleData(item.link);
      if (image) { item.image = image; imgFetched++; }
      if (bodyText) { item._bodyText = bodyText; bodyFetched++; }
      await delay(200);
    }
  }
  console.log(`  图片 ${imgFetched} / 正文 ${bodyFetched}`);

  // 用正文补充模型匹配
  console.log("\n模型标签补充(正文)…");
  for (const item of latest) {
    if (item._bodyText) {
      const bodyModels = matchModels(item._bodyText, "");
      if (bodyModels.length > 0) {
        const combined = new Set([...(item.models || []), ...bodyModels]);
        item.models = [...combined];
      }
    }
    delete item._bodyText; // 不写进 JSON
  }

  // 热度 + 模型
  console.log("\n计算热度…");
  for (const item of latest) {
    item.hotScore = calcHotScore(item.title, item.summary, item.weight || 1, item.date);
  }

  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const recentItems = latest.filter((item) => now - new Date(item.date).getTime() < SEVEN_DAYS);
  const dailyItems = latest.filter((item) => now - new Date(item.date).getTime() < 24 * 60 * 60 * 1000);
  const weeklyItems = latest.filter((item) => now - new Date(item.date).getTime() < SEVEN_DAYS);
  const modelItems = recentItems.filter((item) => item.models.length > 0);

  const news = {
    updated: new Date().toISOString(),
    count: recentItems.length,
    items: recentItems.map(stripItem),
    daily: dailyItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
    weekly: weeklyItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
    models: modelItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
  };
  fs.writeFileSync(path.join(__dirname, "news.json"), JSON.stringify(news, null, 2), "utf-8");
  console.log(`新闻: ${news.count} 条 (日${news.daily.length}/周${news.weekly.length}/模型${news.models.length})`);

  // 视频内容
  console.log("\n=== 抓取视频内容 ===\n");
  const bilibiliVideos = await fetchBilibili();
  const douyinVideos = await fetchDouyin();
  const xPosts = await fetchX();

  const content = {
    updated: new Date().toISOString(),
    bilibili: bilibiliVideos,
    douyin: douyinVideos,
    x: xPosts,
    all: [...bilibiliVideos, ...douyinVideos, ...xPosts].sort((a, b) => b.views - a.views),
  };
  fs.writeFileSync(path.join(__dirname, "content.json"), JSON.stringify(content, null, 2), "utf-8");
  console.log(`\n内容: B站${bilibiliVideos.length} / 抖音${douyinVideos.length} / X${xPosts.length}`);
  console.log("完成！");
}

main().catch((err) => { console.error("出错:", err.message); process.exit(1); });
