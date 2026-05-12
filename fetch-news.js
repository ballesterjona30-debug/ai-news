const RssParser = require("rss-parser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
  "neural network", "transformer", "diffusion", "stable diffusion", "midjourney",
  "robot", "automation", "autonomous", "chip", "gpu", "nvidia", "semiconductor",
  "data center", "compute", "training", "inference", "fine-tun",
  "generative", "agent", "agi", "embedding", "rag", "vector database",
  "人工智能", "大模型", "深度学习", "机器学习", "智能体",
  "openai", "谷歌", "微软", "meta", "英伟达", "算力", "芯片",
];

// 全面模型关键词
const MODEL_KEYWORDS = [
  // OpenAI 系
  { kw: "gpt", tag: "GPT" }, { kw: "chatgpt", tag: "ChatGPT" }, { kw: "openai o", tag: "OpenAI o系列" },
  { kw: "sora", tag: "Sora" }, { kw: "dall-e", tag: "DALL-E" },
  // Anthropic
  { kw: "claude", tag: "Claude" }, { kw: "anthropic", tag: "Claude" },
  // Google
  { kw: "gemini", tag: "Gemini" }, { kw: "deepmind", tag: "Gemini" },
  { kw: "google bard", tag: "Gemini" }, { kw: "veo", tag: "Veo" }, { kw: "google ai", tag: "Google AI" },
  // Meta
  { kw: "llama", tag: "Llama" }, { kw: "meta ai", tag: "Llama" },
  // xAI
  { kw: "grok", tag: "Grok" }, { kw: "xai", tag: "Grok" },
  // Mistral
  { kw: "mistral", tag: "Mistral" },
  // 国内模型
  { kw: "deepseek", tag: "DeepSeek" }, { kw: "深度求索", tag: "DeepSeek" },
  { kw: "通义千问", tag: "通义千问" }, { kw: "qwen", tag: "Qwen" },
  { kw: "文心一言", tag: "文心一言" }, { kw: "ernie", tag: "文心一言" }, { kw: "百度文心", tag: "文心一言" },
  { kw: "kimi", tag: "Kimi" }, { kw: "月之暗面", tag: "Kimi" },
  { kw: "豆包", tag: "豆包" }, { kw: "doubao", tag: "豆包" }, { kw: "字节ai", tag: "豆包" },
  { kw: "minimax", tag: "MiniMax" }, { kw: "海螺ai", tag: "MiniMax" },
  { kw: "智谱", tag: "智谱GLM" }, { kw: "chatglm", tag: "智谱GLM" }, { kw: "glm", tag: "智谱GLM" },
  { kw: "百川", tag: "百川" },
  { kw: "零一万物", tag: "零一万物" }, { kw: "yi-", tag: "零一万物" },
  { kw: "讯飞星火", tag: "讯飞星火" }, { kw: "星火大模型", tag: "讯飞星火" },
  { kw: "商汤", tag: "商汤日日新" }, { kw: "sensetime", tag: "商汤日日新" },
  { kw: "腾讯混元", tag: "腾讯混元" }, { kw: "混元", tag: "腾讯混元" },
  { kw: "昆仑万维", tag: "昆仑万维" }, { kw: "天工ai", tag: "昆仑万维" },
  { kw: "阶跃星辰", tag: "阶跃星辰" }, { kw: "step-", tag: "阶跃星辰" },
  { kw: "面壁智能", tag: "面壁智能" }, { kw: "minicpm", tag: "面壁智能" },
  { kw: "猎户星空", tag: "猎户星空" },
  { kw: "科大讯飞", tag: "讯飞星火" },
  // 其他
  { kw: "cohere", tag: "Cohere" }, { kw: "stability ai", tag: "Stability" },
  { kw: "midjourney", tag: "Midjourney" }, { kw: "runway", tag: "Runway" },
  { kw: "perplexity", tag: "Perplexity" }, { kw: "cursor", tag: "Cursor" },
  { kw: "copilot", tag: "Copilot" }, { kw: "cowork", tag: "Cowork" },
  { kw: "nous", tag: "Nous" }, { kw: "hugging face", tag: "HuggingFace" },
  { kw: "replicate", tag: "Replicate" },
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

// ======= WBI SIGNING FOR BILIBILI =======
let wbiKeys = null;
async function getWbiKeys() {
  if (wbiKeys) return wbiKeys;
  const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com" },
  });
  const data = await res.json();
  const img = data?.data?.wbi_img?.img_url || "";
  const sub = data?.data?.wbi_img?.sub_url || "";
  const imgKey = img.split("/").pop()?.split(".")[0] || "";
  const subKey = sub.split("/").pop()?.split(".")[0] || "";
  wbiKeys = { imgKey, subKey };
  return wbiKeys;
}
function mixWbiKey(imgKey, subKey) {
  const mixinKeyEncTab = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,52,44,34];
  const combined = (imgKey + subKey);
  let result = "";
  for (const idx of mixinKeyEncTab) {
    if (idx < combined.length) result += combined[idx];
  }
  return result.slice(0, 32);
}
function signWbi(params, mixinKey) {
  const sorted = Object.keys(params).sort();
  const query = sorted.map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&");
  const signStr = query + mixinKey;
  return crypto.createHash("md5").update(signStr).digest("hex");
}
async function bilibiliSearch(keyword, page) {
  try {
    const keys = await getWbiKeys();
    if (!keys.imgKey || !keys.subKey) return null;
    const mixin = mixWbiKey(keys.imgKey, keys.subKey);
    const wts = Math.floor(Date.now() / 1000);
    const params = { keyword, order: "totalrank", page: String(page || 1), search_type: "video", wts: String(wts) };
    const w_rid = signWbi(params, mixin);
    const queryParts = Object.entries(params).map(([k,v]) => k+"="+encodeURIComponent(v)).join("&");
    const url = `https://api.bilibili.com/x/web-interface/wbi/search?${queryParts}&w_rid=${w_rid}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.bilibili.com" },
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ======= HELPERS =======
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
  for (const t of HOT_TOPICS) {
    if (text.includes(t.kw.toLowerCase())) topicScore += t.score;
  }
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

async function translateText(text) {
  if (!text || text.length < 5) return text;
  try {
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=en|zh-CN";
    const res = await fetch(url);
    const data = await res.json();
    const translated = data.responseData?.translatedText || "";
    // 检测配额错误，失败时保留原文
    if (!translated || translated.includes("MYMEMORY WARNING") || translated.includes("QUOTA")) {
      return text;
    }
    return translated;
  } catch { return text; }
}

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

// ======= BILIBILI (popular-based, more pages, better AI filter) =======
async function fetchBilibili() {
  console.log("  获取B站AI资讯视频…");
  const allVideos = [];
  const seen = new Set();

  // 多爬热门榜页面，AI筛选
  for (let page = 1; page <= 5; page++) {
    try {
      const url = `https://api.bilibili.com/x/web-interface/popular?ps=50&pn=${page}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.bilibili.com" },
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.list) {
        for (const v of data.data.list) {
          const title = (v.title || "");
          const desc = (v.desc || "").slice(0, 200);
          const text = (title + " " + desc).toLowerCase();

          // 更严格的AI相关性
          const aiCore = ["ai", "人工智能", "大模型", "gpt", "openai", "deepseek", "chatgpt",
            "机器学习", "深度学习", "智能体", "agent", "算力", "gpu", "英伟达", "nvidia",
            "机器人", "自动驾驶", "芯片", "claude", "gemini", "llm", "神经网络",
            "ai工具", "ai开发", "ai行业", "ai融资", "ai芯片", "模型训练", "ai编程",
            "智能驾驶", "具身智能", "claude code"];
          if (!aiCore.some(t => text.includes(t.toLowerCase()))) continue;

          // 排除非AI内容
          const exclude = /漫剧|鬼畜|翻唱|恶仙|哆啦|瓜梦|搞笑|游戏实况|kpop|mv$|官方mv|饭拍|直拍|challenge|舞蹈版|应援|生日|节日快乐|妈妈.*快乐|瓜有引力/i;
          if (exclude.test(text)) continue;
          if (["搞笑","鬼畜","娱乐","音乐","舞蹈","生活","美食","时尚","动物"].includes(v.tname)) continue;

          if (seen.has(v.aid)) continue;
          seen.add(v.aid);
          allVideos.push({
            id: "hot_" + v.aid,
            title,
            desc: desc.slice(0, 120),
            link: v.short_link_v2 || `https://www.bilibili.com/video/${v.bvid}`,
            image: v.pic || "",
            author: v.owner?.name || "",
            views: v.stat?.view || 0,
            platform: "B站",
            type: "video",
          });
        }
      }
      await delay(200);
    } catch (e) {
      console.error(`    B站热门第${page}页失败: ${e.message}`);
    }
  }

  console.log(`  [OK] B站: ${allVideos.length} 个视频`);
  return allVideos;
}

// ======= DOUYIN =======
async function fetchDouyin() {
  console.log("  尝试抖音…");
  const items = [];
  try {
    // 尝试通过搜索热点获取
    const res = await fetch("https://www.douyin.com/aweme/v1/web/hot/search/list/?detail_list=1&count=15", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        "Referer": "https://www.douyin.com",
        "Cookie": "",
      },
    });
    const text = await res.text();
    if (text.startsWith("{")) {
      const data = JSON.parse(text);
      const wordList = data?.data?.word_list || [];
      for (const w of wordList) {
        const title = w.word || "";
        const text2 = title.toLowerCase();
        if (["ai", "人工智能", "gpt", "大模型", "openai", "deepseek", "机器人", "芯片"].some(k => text2.includes(k))) {
          items.push({
            id: "dy_" + crypto.randomUUID(),
            title: "抖音热搜: " + title,
            desc: "热度: " + (w.hot_value || "N/A"),
            link: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
            image: "",
            author: "抖音热搜",
            views: w.hot_value || 0,
            platform: "抖音",
            type: "video",
          });
        }
      }
    }
  } catch (e) {
    console.error("    抖音失败:", e.message);
  }
  console.log(`  [OK] 抖音: ${items.length} 条`);
  return items;
}

// ======= X/TWITTER =======
async function fetchX() {
  console.log("  尝试X…");
  const items = [];
  try {
    // 通过 nitter RSS
    const feed = await parser.parseURL("https://nitter.net/search/rss?q=AI+artificial+intelligence");
    for (const item of (feed.items || []).slice(0, 15)) {
      const title = item.title?.trim() || "";
      if (!title) continue;
      items.push({
        id: "x_" + crypto.randomUUID(),
        title,
        desc: summarize(item.contentSnippet || item.content || ""),
        link: item.link?.trim() || "",
        image: "",
        author: item.creator || item.author || "X",
        views: 0,
        platform: "X",
        type: "post",
      });
    }
  } catch (e) {
    console.error("    X失败:", e.message);
  }
  console.log(`  [OK] X: ${items.length} 条`);
  return items;
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
  console.log(`\n过滤后剩 ${filtered.length} 篇`);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = filtered.slice(0, 50);

  // 翻译
  console.log("\n翻译中…");
  for (let i = 0; i < latest.length; i++) {
    if (latest[i].needsTranslate) {
      latest[i].title = await translateText(latest[i].title);
      latest[i].summary = await translateText(latest[i].summary);
      if (i % 5 === 0) console.log(`  翻译 [${i+1}/${latest.length}]…`);
      await delay(200);
    }
  }

  // 热度 + 模型
  console.log("\n计算热度 & 模型标签…");
  for (const item of latest) {
    item.hotScore = calcHotScore(item.title, item.summary, item.weight || 1, item.date);
    item.models = matchModels(item.title, item.summary);
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

  const allContent = [...bilibiliVideos, ...douyinVideos, ...xPosts];

  const content = {
    updated: new Date().toISOString(),
    bilibili: bilibiliVideos.sort((a, b) => b.views - a.views),
    douyin: douyinVideos,
    x: xPosts,
    all: allContent.sort((a, b) => b.views - a.views),
  };
  fs.writeFileSync(path.join(__dirname, "content.json"), JSON.stringify(content, null, 2), "utf-8");
  console.log(`\n内容: B站${bilibiliVideos.length} / 抖音${douyinVideos.length} / X${xPosts.length}`);
  console.log("完成！");
}

main().catch((err) => { console.error("出错:", err.message); process.exit(1); });
