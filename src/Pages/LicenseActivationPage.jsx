import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon, ClipboardDocumentIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { licenseApi } from "../API/licenseApi";
import logo2 from "../Assets/logo2.png";

const LicenseActivationPage = () => {
  const [hardwareId, setHardwareId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [hw, st] = await Promise.all([
          licenseApi.getHardwareId(),
          licenseApi.getStatus(),
        ]);
        setHardwareId(hw.hardwareId);
        setStatus(st);
        if (st.status === "ACTIVE" || st.status === "GRACE") {
          navigate("/"); // Already active, go to login
        }
      } catch (err) {
        console.error(err);
        setMessage({ type: "error", text: "Failed to load license info. Check backend." });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const copyHardwareId = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setMessage({ type: "error", text: "Please paste your license key." });
      return;
    }
    setActivating(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await licenseApi.activate(licenseKey.trim());
      if (res.success) {
        setMessage({ type: "success", text: `Activated! Valid until ${new Date(res.expiresAt).toLocaleDateString()}.` });
        setTimeout(() => navigate("/"), 2000);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Activation failed. Check license key.";
      setMessage({ type: "error", text: msg });
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ArrowPathIcon className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <img src={logo2} alt="DMS" className="mx-auto w-72 mb-3" />
          <h1 className="text-2xl font-bold text-gray-800">License Activation</h1>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Step 1 — Your Hardware ID</label>
          <div className="flex gap-2">
            <input readOnly value={hardwareId} className="flex-1 p-3 bg-gray-100 rounded-lg font-mono text-xs" />
            <button onClick={copyHardwareId} className="px-4 py-2 bg-gray-200 rounded-lg flex items-center text-sm">
              {copied ? <CheckCircleIcon className="w-4 h-4 mr-1 text-green-600" /> : <ClipboardDocumentIcon className="w-4 h-4 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Step 2 — Paste License Key</label>
          <textarea
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            rows={5}
            className="w-full p-3 border rounded-lg font-mono text-xs"
            placeholder="Paste license key..."
          />
        </div>

        {message.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}

        <button onClick={handleActivate} disabled={activating} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
          {activating ? "Activating..." : "Activate License"}
        </button>
      </div>
    </div>
  );
};

export default LicenseActivationPage;