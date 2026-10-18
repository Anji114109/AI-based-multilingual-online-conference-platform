import express from "express";
import axios from "axios";
import PDFDocument from "pdfkit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { meetingSummariesCollection, meetingsCollection } from "../db/collections.js";
import { saveMeetingSummary } from "../services/meetingPersistenceService.js";

const router = express.Router();

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
};

const PDF_FONT_CANDIDATES = [
  "C:/Windows/Fonts/Nirmala.ttc",
  "C:/Windows/Fonts/Nirmala.ttf",
  "C:/Windows/Fonts/NirmalaUI.ttf",
  "C:/Windows/Fonts/NirmalaUI.ttc",
  "C:/Windows/Fonts/LeelawUI.ttf",
  "C:/Windows/Fonts/LeelaUIb.ttf",
  "C:/Windows/Fonts/arial.ttf",
];

const applyPdfFont = (doc) => {
  for (const fontPath of PDF_FONT_CANDIDATES) {
    if (!fs.existsSync(fontPath)) continue;

    try {
      doc.font(fontPath);
      return fontPath;
    } catch {
      continue;
    }
  }

  doc.font("Helvetica");
  return "Helvetica";
};

const dedupeNonEmptyLines = (text) => {
  const seen = new Set();

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n");
};

const buildFallbackPdfBuffer = ({ hostName, subject, lang, transcriptList }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontName = applyPdfFont(doc);

    doc.font(fontName).fontSize(19).fillColor("#0f2f7a").text(`${(hostName || "HOST").toUpperCase()} -- ${(subject || "GENERAL DISCUSSION").toUpperCase()}`);
    doc.moveDown(0.8);
    doc.fillColor("#111111");

    if (!transcriptList.length) {
      doc
        .fontSize(12)
        .text(
          "No transcript entries were available for this meeting at download time. " +
            "Please ensure participants spoke during the call and try again."
        );
      doc.end();
      return;
    }

    console.log(`Building fallback PDF with ${transcriptList.length} transcript entries for language ${lang}`);

    transcriptList.forEach((entry, idx) => {
      const speaker = entry?.speaker || "Speaker";
      const lineText =
        lang === "en"
          ? entry?.original || entry?.translated || ""
          : entry?.translated || entry?.original || "";

      if (lineText?.trim()) {
        doc
          .font(fontName)
          .fontSize(11)
          .fillColor("#111111")
          .text(`${speaker}: ${lineText}`);
        doc.moveDown(0.6);
      }
    });

    doc.end();
  });

const buildSummaryPdfBuffer = ({ hostName, subject, summaryText }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontName = applyPdfFont(doc);

    doc.font(fontName).fontSize(19).fillColor("#0f2f7a").text(`${(hostName || "HOST").toUpperCase()} -- ${(subject || "GENERAL DISCUSSION").toUpperCase()}`);
    doc.moveDown(0.8);
    doc.fillColor("#111111");

    if (!summaryText?.trim()) {
      doc
        .fontSize(12)
        .text("No stored summary was available for this meeting at download time.");
      doc.end();
      return;
    }

    dedupeNonEmptyLines(summaryText)
      .split("\n")
      .forEach((line) => {
        doc.font(fontName).fontSize(11).fillColor("#111111").text(line);
        doc.moveDown(0.55);
      });

    doc.end();
  });

const fetchTranscript = async (meetingId, targetLang) => {
  const transcriptRes = await axios.get(
    `http://127.0.0.1:8000/transcript/${meetingId}?lang=${encodeURIComponent(targetLang)}`
  );
  return transcriptRes.data?.transcript || [];
};

const fetchStoredSummary = async (meetingId, targetLang) => {
  const exact = await meetingSummariesCollection().findOne(
    { meeting_id: meetingId, language: targetLang },
    { projection: { _id: 0, summary_text: 1, language: 1, updated_at: 1, generated_at: 1 } }
  );

  if (exact?.summary_text?.trim()) {
    return exact;
  }

  const latest = await meetingSummariesCollection()
    .find(
      { meeting_id: meetingId },
      {
        projection: { _id: 0, summary_text: 1, language: 1, updated_at: 1, generated_at: 1 },
        sort: { updated_at: -1, generated_at: -1 },
      }
    )
    .limit(1)
    .next();

  return latest || null;
};

const runGeminiWithFallback = async ({ prompt }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  let lastError = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      if (!text) {
        throw new Error("Gemini returned empty text");
      }

      return { text, modelName };
    } catch (err) {
      lastError = err;
      console.warn(`PDF Gemini model failed (${modelName}):`, err.message);
    }
  }

  throw lastError || new Error("No Gemini model available");
};

const polishAndTranslateSummary = async ({ summaryText, targetLang }) => {
  const langName = LANGUAGE_NAMES[targetLang] || "English";

  const prompt = `
You are an expert meeting summarizer.
Tasks:
1. Correct grammar, spelling, punctuation, and sentence clarity.
2. Preserve factual meaning.
3. Keep each line in the format: Speaker: sentence.
4. Translate the final result into ${langName}.
5. Return only the final lines, no markdown.

Summary:
${summaryText}
`;

  const { text, modelName } = await runGeminiWithFallback({ prompt });
  return { summaryText: text, modelName };
};

const saveSummarySnapshot = async ({ meetingId, targetLang, transcriptList }) => {
  if (!transcriptList.length) return;

  // Build summary preserving all meaningful entries (dedupe only exact line duplicates)
  const summaryLines = transcriptList
    .map((entry) => {
      const text =
        targetLang === "en"
          ? entry.original
          : entry.translated || entry.original;
      return text?.trim() ? `${entry.speaker || "Speaker"}: ${text}` : null;
    })
    .filter(Boolean);

  if (!summaryLines.length) return;

  const summaryText = dedupeNonEmptyLines(summaryLines.join("\n")).slice(0, 12000);

  await saveMeetingSummary({
    meetingId,
    language: targetLang,
    summaryText,
    transcriptCount: transcriptList.length,
  });
};

router.get("/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { lang } = req.query;
    const targetLang = lang || "en";

    const meeting = await meetingsCollection().findOne(
      { meeting_id: meetingId },
      { projection: { _id: 0, host_name: 1, subject: 1 } }
    );

    const hostName = meeting?.host_name || "Host";
    const meetingSubject = meeting?.subject || "General Discussion";

    const transcriptList = await fetchTranscript(meetingId, targetLang).catch(() => []);
    console.log(
      `PDF route: fetched ${transcriptList.length} transcript entries for meeting ${meetingId} (lang: ${targetLang})`
    );

    let pdfBuffer;

    if (targetLang !== "en") {
      try {
        // Prefer Python renderer for Indic scripts (better Unicode/font handling).
        const upstreamPdf = await axios.get(
          `http://127.0.0.1:8000/pdf/${meetingId}?lang=${targetLang}&host_name=${encodeURIComponent(hostName)}&subject=${encodeURIComponent(meetingSubject)}`,
          { responseType: "arraybuffer" }
        );

        pdfBuffer = upstreamPdf.data;
      } catch (upstreamErr) {
        console.warn(
          "Non-English upstream PDF fallback warning:",
          upstreamErr.response?.status || upstreamErr.message
        );
      }
    }

    if (!pdfBuffer && transcriptList.length) {
      pdfBuffer = await buildFallbackPdfBuffer({
        hostName,
        subject: meetingSubject,
        lang: targetLang,
        transcriptList,
      });
    } else if (!pdfBuffer) {
      try {
        const upstreamPdf = await axios.get(
          `http://127.0.0.1:8000/pdf/${meetingId}?lang=${targetLang}&host_name=${encodeURIComponent(hostName)}&subject=${encodeURIComponent(meetingSubject)}`,
          { responseType: "arraybuffer" }
        );

        pdfBuffer = upstreamPdf.data;
      } catch (upstreamErr) {
        if (upstreamErr.response?.status !== 404) {
          throw upstreamErr;
        }

        const storedSummary = await fetchStoredSummary(meetingId, targetLang);

        if (storedSummary?.summary_text?.trim()) {
          let summaryText = storedSummary.summary_text;

          try {
            const polished = await polishAndTranslateSummary({
              summaryText,
              targetLang,
            });
            summaryText = polished.summaryText;
            console.log(`Summary panel PDF used Gemini model: ${polished.modelName}`);
          } catch (gemErr) {
            console.warn("Summary panel Gemini refine warning:", gemErr.message);
          }

          await saveMeetingSummary({
            meetingId,
            language: targetLang,
            summaryText,
            transcriptCount: 0,
          });

          pdfBuffer = await buildSummaryPdfBuffer({
            hostName,
            subject: meetingSubject,
            summaryText,
          });
        } else {
          pdfBuffer = await buildFallbackPdfBuffer({
            hostName,
            subject: meetingSubject,
            lang: targetLang,
            transcriptList,
          });
        }
      }
    }

    try {
      await saveSummarySnapshot({ meetingId, targetLang, transcriptList });
    } catch (summaryErr) {
      console.error("Summary save warning:", summaryErr.message);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=meeting-${meetingId}-${targetLang}.pdf`
    );

    res.send(pdfBuffer);

  } catch (err) {
    const upstreamStatus = err.response?.status;
    const upstreamMessage = err.response?.data?.error || err.message;

    console.error("PDF error:", upstreamStatus || 500, upstreamMessage);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

export default router;