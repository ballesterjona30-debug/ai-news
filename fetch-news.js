const RssParser = require("rss-parser");
const fs = require("fs");
const path = require("path");

const parser = new RssParser({
  timeout: 15000,
  headers: { "User-Agent": "AI-News-Aggregator/1.0" },
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
  "ai", "人工智能", "大模型", "深度学习", "机器学习", "智能体",
  "openai", "谷歌", "微软", "meta", "英伟达", "算力", "芯片",
];

// 模型关键词：匹配到的文章会被打标签
const MODEL_KEYWORDS = [
  { kw: "gpt", tag: "GPT" }, { kw: "chatgpt", tag: "ChatGPT" },
  { kw: "claude", tag: "Claude" }, { kw: "anthropic", tag: "Claude" },
  { kw: "gemini", tag: "Gemini" }, { kw: "google deepmind", tag: "Gemini" },
  { kw: "deepseek", tag: "DeepSeek" }, { kw: "深度求索", tag: "DeepSeek" },
  { kw: "minimax", tag: "MiniMax" }, { kw: "海螺ai", tag: "MiniMax" }, { kw: "minimo", tag: "MiniMax" },
  { kw: "qwen", tag: "Qwen" }, { kw: "通义千问", tag: "Qwen" },
  { kw: "llama", tag: "Llama" }, { kw: "meta ai", tag: "Llama" },
  { kw: "mistral", tag: "Mistral" },
  { kw: "grok", tag: "Grok" }, { kw: "xai", tag: "Grok" },
  { kw: "kimi", tag: "Kimi" }, { kw: "月之暗面", tag: "Kimi" },
  { kw: "doubao", tag: "豆包" },
  { kw: "文心一言", tag: "文心一言" }, { kw: "ernie", tag: "文心一言" },
  { kw: "midjourney", tag: "Midjourney" },
  { kw: "stable diffusion", tag: "SD" }, { kw: "sora", tag: "Sora" },
  { kw: "perplexity", tag: "Perplexity" },
  { kw: "nous", tag: "Nous" },
  { kw: "cursor", tag: "Cursor" },
  { kw: "copilot", tag: "Copilot" }, { kw: "github copilot", tag: "Copilot" },
  { kw: "cowork", tag: "Cowork" },
];

// 热门话题额外加分
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
  const age = now - new Date(dateStr).getTime();
  const hours = age / (1000 * 60 * 60);

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

  const total = Math.round(recencyScore + sourceScore + topicScore + qualityScore);
  return Math.min(total, 100);
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

async function translateText(text) {
  if (!text || text.length < 5) return text;
  try {
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=en|zh-CN";
    const res = await fetch(url);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch {
    return text;
  }
}

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
        source: source.name,
        weight: source.weight,
        date: item.pubDate || item.isoDate || new Date().toISOString(),
        needsTranslate: source.lang === "en",
      });
    }
    console.log(`  [OK] ${source.name}: ${items.length} 篇`);
    return items;
  } catch (err) {
    console.error(`  [SKIP] ${source.name}: ${err.message}`);
    return [];
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripItem(item) {
  return { title: item.title, summary: item.summary, link: item.link, source: item.source, date: item.date, hotScore: item.hotScore, models: item.models || [] };
}

async function main() {
  console.log("抓取 AI 新闻中…\n");
  const promises = SOURCES.map((s) => fetchFeed(s));
  const results = await Promise.all(promises);
  let all = results.flat();

  const seen = new Set();
  const deduped = [];
  for (const item of all) {
    const key = normalizeTitle(item.title).slice(0, 40);
    if (!seen.has(key)) { seen.add(key); deduped.push(item); }
  }

  const filtered = deduped.filter((item) => isAIArticle(item.title, item.summary));
  console.log(`\n过滤后剩 ${filtered.length} 篇（去除非AI内容）`);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = filtered.slice(0, 50);

  console.log("\n翻译英文内容中…");
  for (let i = 0; i < latest.length; i++) {
    const item = latest[i];
    if (item.needsTranslate) {
      console.log(`  翻译 [${i + 1}/${latest.length}] ${item.title.slice(0, 40)}…`);
      item.title = await translateText(item.title);
      item.summary = await translateText(item.summary);
      await delay(200);
    }
  }

  // 计算热度 + 模型标签
  console.log("\n计算热度 & 模型标签…");
  for (const item of latest) {
    item.hotScore = calcHotScore(item.title, item.summary, item.weight || 1, item.date);
    item.models = matchModels(item.title, item.summary);
  }

  const now = Date.now();
  const dailyItems = latest.filter((item) => now - new Date(item.date).getTime() < 24 * 60 * 60 * 1000);
  const weeklyItems = latest.filter((item) => now - new Date(item.date).getTime() < 7 * 24 * 60 * 60 * 1000);
  const modelItems = latest.filter((item) => item.models.length > 0);

  const out = {
    updated: new Date().toISOString(),
    count: latest.length,
    items: latest.map(stripItem),
    daily: dailyItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
    weekly: weeklyItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
    models: modelItems.sort((a, b) => b.hotScore - a.hotScore).map(stripItem),
  };

  const outPath = path.join(__dirname, "news.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`\n完成！${out.count} 条 (日榜 ${out.daily.length} / 周榜 ${out.weekly.length} / 模型 ${out.models.length})`);
}

main().catch((err) => {
  console.error("出错:", err.message);
  process.exit(1);
});
