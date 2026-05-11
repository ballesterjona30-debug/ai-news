const RssParser = require("rss-parser");
const fs = require("fs");
const path = require("path");

const parser = new RssParser({
  timeout: 15000,
  headers: { "User-Agent": "AI-News-Aggregator/1.0" },
});

const SOURCES = [
  { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", lang: "en" },
  { name: "MIT科技评论", url: "https://www.technologyreview.com/feed/", lang: "en" },
  { name: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/", lang: "en" },
  { name: "量子位", url: "https://www.qbitai.com/feed", lang: "zh" },
  { name: "机器之心", url: "https://www.jiqizhixin.com/rss", lang: "zh" },
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
        title,
        summary,
        link: item.link?.trim() || "",
        source: source.name,
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

async function main() {
  console.log("抓取 AI 新闻中…\n");

  const promises = SOURCES.map((s) => fetchFeed(s));
  const results = await Promise.all(promises);
  let all = results.flat();

  const seen = new Set();
  const deduped = [];
  for (const item of all) {
    const key = normalizeTitle(item.title).slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  const filtered = deduped.filter((item) => isAIArticle(item.title, item.summary));
  console.log(`\n过滤后剩 ${filtered.length} 篇（去除非AI内容）`);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = filtered.slice(0, 35);

  console.log("\n翻译英文内容中…");
  for (let i = 0; i < latest.length; i++) {
    const item = latest[i];
    if (item.needsTranslate) {
      console.log(`  翻译 [${i + 1}/${latest.length}] ${item.title.slice(0, 40)}…`);
      item.title = await translateText(item.title);
      item.summary = await translateText(item.summary);
      await delay(500);
    }
  }

  const out = {
    updated: new Date().toISOString(),
    count: latest.length,
    items: latest.map(({ title, summary, link, source, date }) => ({
      title, summary, link, source, date,
    })),
  };

  const outPath = path.join(__dirname, "news.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`\n完成！${out.count} 条中文资讯已保存到 news.json`);
}

main().catch((err) => {
  console.error("出错:", err.message);
  process.exit(1);
});
