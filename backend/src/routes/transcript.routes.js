import express from "express";
import axios from "axios";

const router = express.Router();

// 🔥 Fetch transcript from Python
router.get("/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;

    const response = await axios.get(
      `http://127.0.0.1:8000/transcript/${meetingId}`
    );

    res.json(response.data);
  } catch (err) {
    const upstreamStatus = err.response?.status;
    const upstreamMessage = err.response?.data?.error || err.message;

    if (upstreamStatus === 404) {
      return res.status(404).json({ error: "Transcript not found" });
    }

    console.error("Transcript fetch error:", upstreamStatus || 500, upstreamMessage);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

export default router;