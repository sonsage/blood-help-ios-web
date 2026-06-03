const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0";
const root = __dirname;
const bloodBaseUrl = "https://www.blood.org.tw/xcevent";
const serverVersion = "20260603-2";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (requestUrl.pathname === "/api/xcevent") {
      await proxyBloodPage(requestUrl, response);
      return;
    }
    serveStatic(requestUrl, response);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close the other server or run: $env:PORT=4174; node server.js`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Serving! version ${serverVersion}`);
  console.log(`- Local:   http://localhost:${port}`);
  getLocalIps().forEach((ip) => console.log(`- Network: http://${ip}:${port}`));
  console.log("Keep this PowerShell window open. Press Ctrl+C to stop.");
});

async function proxyBloodPage(requestUrl, response) {
  const page = requestUrl.searchParams.get("page");
  const targetUrl = new URL(bloodBaseUrl);
  if (page) targetUrl.searchParams.set("page", page);
  const target = targetUrl.toString();
  console.log(`Proxy: ${target}`);
  const upstream = await fetch(target, {
    headers: {
      "Accept": "text/html",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "Referer": "https://www.blood.org.tw/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    }
  });
  const body = await upstream.text();
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
}

function getLocalIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => network.address);
}
