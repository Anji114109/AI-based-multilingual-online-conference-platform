import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./SummaryPage.css";

const SummaryPage = () => {
  const { id: meetingId } = useParams();
  const navigate = useNavigate();

  const [language, setLanguage] = useState("en");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;

  const downloadPDF = async () => {
    setIsDownloading(true);
    setDownloadError("");
    try {
      // Now download the PDF with selected language
      const res = await axios.get(
        `${API_BASE}/pdf/${meetingId}?lang=${language}`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([res.data])
      );

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `meeting-${meetingId}-${language}.pdf`
      );

      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error("PDF download error:", err);
      const backendError = err?.response?.data?.error;
      setDownloadError(backendError || "Unable to generate PDF for this meeting.");
    } finally {
      setIsDownloading(false);
      setIsModifying(false);
    }
  };

  return (
    <div className="summary-page">
      <div className="summary-card">
        <h2>Meeting Summary</h2>
        <p className="summary-subtitle">
          Choose a language and download your translated summary PDF.
        </p>

        <label htmlFor="summary-language" className="summary-label">
          Summary Language
        </label>
        <select
          id="summary-language"
          className="summary-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isDownloading}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
          <option value="ta">Tamil</option>
        </select>

        <div className="summary-actions">
          <button
            onClick={downloadPDF}
            className="summary-btn summary-btn-primary"
            disabled={isDownloading}
          >
            Download Summary PDF
          </button>

          <button
            onClick={() => navigate(`/meeting/${meetingId}`)}
            className="summary-btn"
            disabled={isDownloading}
          >
            Back to Meeting
          </button>

          <button
            onClick={() => navigate("/")}
            className="summary-btn"
            disabled={isDownloading}
          >
            Return to Home
          </button>
        </div>

        {isDownloading && (
          <div className="summary-loader-wrap" role="status" aria-live="polite">
            <div className="summary-loader" />
            <span>
              {isModifying
                ? "Improving summary with AI. Please wait..."
                : `Generating ${language.toUpperCase()} summary PDF. Please wait...`}
            </span>
          </div>
        )}

        {downloadError && (
          <div className="join-status" role="alert" style={{ marginTop: 12 }}>
            {downloadError}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;