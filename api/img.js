/**
 * 네이버 블로그 이미지 중계 (Vercel 서버리스 함수)
 * GET /api/img?u=<pstatic.net 이미지 주소>
 *
 * 네이버 이미지 서버는 다른 사이트에서 바로 불러오면 막는 경우가 있어,
 * 이 함수가 대신 받아서 전달합니다. 네이버 이미지 주소(pstatic.net)만 허용합니다.
 */
module.exports = async (req, res) => {
  const u = String((req.query && req.query.u) || "");
  let url;
  try { url = new URL(u); } catch (_) { return res.status(400).end("bad url"); }
  if (url.protocol !== "https:" || !/(^|\.)pstatic\.net$/.test(url.hostname)) return res.status(403).end("forbidden");

  try {
    const r = await fetch(url.toString(), {
      headers: { Referer: "https://blog.naver.com/", "User-Agent": "Mozilla/5.0" },
    });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) return res.status(502).end("upstream error");
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    return res.status(200).send(buf);
  } catch (_) {
    return res.status(502).end("upstream error");
  }
};
