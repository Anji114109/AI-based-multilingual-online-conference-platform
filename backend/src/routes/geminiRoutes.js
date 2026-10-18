import express from "express";
import { correctTranscriptController, modifySummaryController } from "../controllers/geminiController.js";

const router = express.Router();

router.post("/correct", correctTranscriptController);
router.post("/modify-summary", modifySummaryController);

export default router;
