const bloodBaseUrl = "https://www.blood.org.tw/xcevent";

module.exports = async function handler(request, response) {
  try {
    const page = request.query.page;
    const targetUrl = new URL(bloodBaseUrl);
    if (page) targetUrl.searchParams.set("page", String(page));

    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        "Accept": "text/html",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.blood.org.tw/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
      }
    });

    const body = await upstream.text();
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    response.status(200).send(body);
  } catch (error) {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(500).send("Proxy error");
  }
};
