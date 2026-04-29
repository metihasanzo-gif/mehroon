const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

function normalizeTargetBase(value) {
  return String(value || "").replace(/\/$/, "");
}

export default {
  async fetch(request, env) {
    const TARGET_BASE = normalizeTargetBase(env.TARGET_DOMAIN);

    if (!TARGET_BASE) {
      return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
    }

    try {
      const incomingUrl = new URL(request.url);
      const targetUrl = TARGET_BASE + incomingUrl.pathname + incomingUrl.search;

      const out = new Headers();
      let clientIp = null;

      for (const [rawKey, value] of request.headers) {
        const key = rawKey.toLowerCase();

        if (key === "cf-connecting-ip" || key === "x-real-ip" || key === "x-forwarded-for") {
          if (!clientIp) clientIp = value;
          continue;
        }

        if (STRIP_HEADERS.has(key)) continue;
        if (key.startsWith("x-vercel-")) continue;
        if (key.startsWith("cf-") || key.startsWith("x-cf-")) continue;

        out.set(rawKey, value);
      }

      if (clientIp) out.set("x-forwarded-for", clientIp);

      const method = request.method;
      const hasBody = method !== "GET" && method !== "HEAD";

      return await fetch(targetUrl, {
        method,
        headers: out,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
      });
    } catch (err) {
      console.error("relay error:", err);
      return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
    }
  },
};
