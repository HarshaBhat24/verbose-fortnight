require("dotenv").config();
const express = require("express");
const path = require("path");

const startHandler = require("./api/interview/start");
const turnHandler = require("./api/interview/turn");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Mount API routes matching Vercel path mapping
app.all("/api/interview/start", async (req, res) => {
  try {
    await startHandler(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  }
});

app.all("/api/interview/turn", async (req, res) => {
  try {
    await turnHandler(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Pentest Interview Prep Server Running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
