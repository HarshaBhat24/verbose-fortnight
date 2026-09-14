// Shared helpers for the two API routes.
// Frontend is deployed separately (you said you're building/connecting your own),
// so every response needs CORS headers or the browser will silently block it.

function withCors(res) {
  // Tighten this to your actual frontend origin once you know it —
  // "*" is fine while you're the only caller during dev.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

function handlePreflight(req, res) {
  if (req.method === "OPTIONS") {
    withCors(res).status(204).end();
    return true;
  }
  return false;
}

function sendJson(res, status, body) {
  withCors(res).status(status).json(body);
}

module.exports = { withCors, handlePreflight, sendJson };
