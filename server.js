import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = 5000;

const API_URLS = [
  "https://script.google.com/macros/s/AKfycbznSI21r4TTdKh8LhIIgqnhjNC8YkVcyEkxLDBpn-UEQiLkmkdXu5U5cxYH3iyjmm2Q/exec",
  "https://script.google.com/macros/s/AKfycbyPFdBnaCvsArf3FGBWLo3ZFg70f17yqgtnScQjBNjPbuCaHonJ7E-orPhn2NcFYD4lNw/exec"
];

app.use(cors());
app.use(express.json());

app.get("/api", async (req, res) => {
  const targetBase = API_URLS[Math.floor(Math.random() * API_URLS.length)];
  const rawQuery = req.query.__rawQuery || "";
  const targetUrl = `${targetBase}?${rawQuery}`;

  try {
    const response = await fetch(targetUrl, { redirect: "follow" });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch from GAS", details: err.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
