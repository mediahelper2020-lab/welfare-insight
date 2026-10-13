/**
 * 네이버 블로그 "교육현장" 카테고리 글 목록 (Vercel 서버리스 함수)
 * GET /api/blog            → { ok, source, category, items: [{ title, link, image, date, summary }] }
 *
 * 브라우저는 네이버 블로그를 직접 읽을 수 없어서(CORS), 이 함수가 대신 가져옵니다.
 * 결과는 Vercel에 10분간 캐시되므로, 새 글은 보통 10분 안에 홈페이지에 나타납니다.
 *
 * 1순위: 네이버 모바일 블로그 API (카테고리별 목록 + 썸네일)
 * 2순위: 네이버 블로그 RSS (최근 글 중 카테고리 이름으로 걸러냄)
 */

const BLOG_ID = process.env.NAVER_BLOG_ID || "mediahelper";
const CATEGORY = process.env.NAVER_BLOG_CATEGORY || "교육현장";
const LIMIT = 12;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

module.exports = async (req, res) => {
  const limit = Math.min(Number(req.query && req.query.limit) || LIMIT, 30);
  let result = null;
  const errors = [];

  for (const source of [fromMobileApi, fromRss]) {
    try {
      const items = await source(limit);
      if (items && items.length) { result = { source: source.name, items }; break; }
    } catch (e) {
      errors.push(`${source.name}: ${e.message}`);
    }
  }

  if (result) {
    await fillMissingImages(result.items);
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).json({ ok: true, blog: `https://blog.naver.com/${BLOG_ID}`, category: CATEGORY, ...result });
  }
  res.setHeader("Cache-Control", "public, s-maxage=60");
  return res.status(200).json({ ok: false, blog: `https://blog.naver.com/${BLOG_ID}`, category: CATEGORY, items: [], errors });
};

/* ---------- 1) 모바일 블로그 API ---------- */
async function fromMobileApi(limit) {
  const headers = { "User-Agent": UA, Referer: `https://m.blog.naver.com/${BLOG_ID}`, Accept: "application/json" };
  const cats = await getJson(`https://m.blog.naver.com/api/blogs/${BLOG_ID}/category-list`, headers);
  const list = (cats && cats.result && (cats.result.mylogCategoryList || cats.result.categoryList)) || [];
  const cat = list.find((c) => clean(c.categoryName) === CATEGORY) || list.find((c) => clean(c.categoryName).includes(CATEGORY));
  if (!cat) throw new Error(`'${CATEGORY}' 카테고리를 찾지 못함`);

  const data = await getJson(
    `https://m.blog.naver.com/api/blogs/${BLOG_ID}/post-list?categoryNo=${cat.categoryNo}&itemCount=${limit}&page=1`,
    headers
  );
  const items = (data && data.result && data.result.items) || [];
  return items.slice(0, limit).map((it) => ({
    title: clean(stripTags(it.titleWithInspectMessage || it.title || "")),
    link: `https://blog.naver.com/${BLOG_ID}/${it.logNo}`,
    image: it.thumbnailUrl ? thumb(it.thumbnailUrl) : "",
    date: it.addDate ? new Date(Number(it.addDate)).toISOString() : "",
    summary: clean(stripTags(it.briefContents || "")).slice(0, 120),
    logNo: String(it.logNo || ""),
  })).filter((x) => x.title && x.logNo);
}

/* ---------- 2) RSS ---------- */
async function fromRss(limit) {
  const xml = await getText(`https://rss.blog.naver.com/${BLOG_ID}.xml`, { "User-Agent": UA });
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const block = m[1];
    const pick = (tag) => {
      const r = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
      return r ? r[1].trim() : "";
    };
    const desc = decode(pick("description"));
    const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
    const link = decode(pick("link")).replace(/\?.*$/, "");
    return {
      category: clean(decode(pick("category"))),
      title: clean(decode(stripTags(decode(pick("title"))))),
      link,
      image: img ? thumb(img[1]) : "",
      date: pick("pubDate") ? new Date(pick("pubDate")).toISOString() : "",
      summary: clean(stripTags(desc)).slice(0, 120),
      logNo: (link.match(/(\d{6,})$/) || [])[1] || "",
    };
  });
  return items.filter((x) => x.category.includes(CATEGORY)).slice(0, limit).map(({ category, ...rest }) => rest);
}

/* ---------- 썸네일이 없으면 글의 대표 이미지(og:image) ---------- */
async function fillMissingImages(items) {
  const need = items.filter((x) => !x.image && x.logNo).slice(0, 12);
  await Promise.all(need.map(async (x) => {
    try {
      const html = await getText(`https://m.blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${x.logNo}`, { "User-Agent": UA }, 4000);
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og) x.image = thumb(decode(og[1]));
    } catch (_) { /* 이미지 없이 표시 */ }
  }));
  items.forEach((x) => delete x.logNo);
}

/* ---------- helpers ---------- */
async function getText(url, headers, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function getJson(url, headers) { return JSON.parse(await getText(url, headers)); }

// 네이버 이미지 주소를 카드용 크기로 (가로 400px)
function thumb(url) {
  if (!/phinf\.pstatic\.net/.test(url)) return url; // blogthumb 등은 원래 주소 그대로
  return `${url.replace(/\?.*$/, "")}?type=w400`;
}
function stripTags(s) { return String(s).replace(/<[^>]*>/g, " "); }
function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
function decode(s) {
  return String(s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
