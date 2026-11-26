import { useEffect, useState, useMemo } from "react";
import apiClient from "../API/apiClient";
import AutoTranslate from "../i18n/AutoTranslate";
import { MdOutlineClose } from "react-icons/md";

const ACTIVITY_META = {
  Update:       { icon: "✏️", label: "Document Updated", color: "bg-blue-100 text-blue-800" },
  Create:       { icon: "➕", label: "Document Created", color: "bg-green-100 text-green-800" },
  StatusChange: { icon: "🔔", label: "Status Changed",   color: "bg-amber-100 text-amber-800" },
};

// Approve / Reject get their own label and colour
const getMeta = (log, details) => {
  if (log.activity === "StatusChange") {
    if (details.newStatus === "APPROVED") {
      return { icon: "✅", label: "File Approved", color: "bg-green-100 text-green-800" };
    }
    if (details.newStatus === "REJECTED") {
      return { icon: "❌", label: "File Rejected", color: "bg-red-100 text-red-800" };
    }
  }
  return ACTIVITY_META[log.activity] || { icon: "•", label: log.activity, color: "bg-gray-100 text-gray-800" };
};

const fmt = (d) => {
  if (!d) return "--";
  const x = new Date(d);
  return isNaN(x.getTime()) ? "--" : x.toLocaleString("en-GB");
};

const parseDetails = (raw) => {
  if (!raw) return {};
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const statusBadge = (status) => {
  const cls =
    status === "APPROVED" ? "bg-green-100 text-green-800"
    : status === "REJECTED" ? "bg-red-100 text-red-800"
    : "bg-yellow-100 text-yellow-800";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{status || "--"}</span>
  );
};

const VersionHistoryModal = ({ isOpen, onClose, headerId, title }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rawLogs, setRawLogs] = useState([]);

  // UI State
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const itemsPerPage = 5;

  // Label only. The backend already filters the rows by the logged-in user's role.
  // Checks a few common keys; if it still shows "Unknown Role", open DevTools ->
  // Application -> Local Storage and add the key your app really uses.
  const currentUserRole =
    localStorage.getItem("roleName") ||
    localStorage.getItem("role") ||
    localStorage.getItem("userRole") ||
    localStorage.getItem("roleCode") ||
    "";

  useEffect(() => {
    if (!isOpen || !headerId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get(`/api/documents/${headerId}/change-history`);
        if (!cancelled) {
          const rawData = Array.isArray(res.data) ? [...res.data] : [];

          // Role filtering is done on the server (filterLogsByRole), so none here.
          // Sort oldest first to build the timeline properly
          rawData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setRawLogs(rawData);
        }
      } catch (e) {
        if (!cancelled) setError("Could not load change history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, headerId]);

  useEffect(() => {
    if (isOpen) {
      setFilter("all");
      setCurrentPage(1);
      setExpandedLogId(null);
    }
  }, [isOpen]);

  const timelineEvents = useMemo(() => {
    let currentState = {
      title: "--", subject: "--", category: "--", year: "--", version: "--", files: []
    };
    const processedEvents = [];

    rawLogs.forEach((log) => {
      const d = parseDetails(log.detailsJson);

      // 🆕 Approve / Reject rows: always show them as their own event
      if (log.activity === "StatusChange") {
        processedEvents.push({
          log,
          details: d,
          before: JSON.parse(JSON.stringify(currentState)),
          after: { ...currentState },
          isCreation: false,
          isStatusChange: true,
          hasFileChange: false,
          hasMetaChange: false,
        });
        return;
      }

      const isCreation = log.activity === "Create";

      const beforeState = JSON.parse(JSON.stringify(currentState));
      let hasFileChange = false;
      let hasMetaChange = false;

      if (isCreation) {
        currentState.title = d.title || currentState.title;
        currentState.subject = d.subject || currentState.subject;
        currentState.category = d.category || currentState.category;
        currentState.year = d.year || currentState.year;
        currentState.version = d.version || currentState.version;

        if (d.fileName) currentState.files = [d.fileName];
        else if (d.files) currentState.files = d.files;
        else if (log.documentName) currentState.files = [log.documentName];

        processedEvents.push({
          log, details: d,
          before: { title: "--", subject: "--", category: "--", year: "--", version: "--", files: [] },
          after: { ...currentState }, isCreation: true, isStatusChange: false,
          hasFileChange: true, hasMetaChange: true
        });
        return;
      }

      if (d.before && d.after) {
        currentState.files = d.after.files || currentState.files;
        hasFileChange = true;
      }

      if (d.title) {
        if (currentState.title !== d.title) hasMetaChange = true;
        currentState.title = d.title;
        currentState.subject = d.subject || currentState.subject;
        currentState.category = d.category || currentState.category;
        currentState.year = d.year || currentState.year;
        currentState.version = d.version || currentState.version;
      }

      if (hasFileChange || hasMetaChange) {
        processedEvents.push({
          log, details: d, before: beforeState, after: { ...currentState },
          isCreation: false, isStatusChange: false, hasFileChange, hasMetaChange
        });
      }
    });

    return processedEvents.reverse();
  }, [rawLogs]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return timelineEvents;
    if (filter === "files") return timelineEvents.filter(e => e.hasFileChange || e.isCreation);
    if (filter === "metadata") return timelineEvents.filter(e => e.hasMetaChange && !e.isCreation);
    if (filter === "status") return timelineEvents.filter(e => e.isStatusChange);
    return timelineEvents;
  }, [timelineEvents, filter]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 🆕 Details for an Approve / Reject event
  const renderStatusTable = (details, log) => {
    const rows = [
      ["File", details.fileName || log.documentName || "--"],
      ["Version", details.version || "--"],
      ["Year", details.year || "--"],
    ];

    return (
      <>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100 w-1/4 text-sm">{label}</td>
            <td className="px-4 py-2 border-b border-gray-100 text-sm text-gray-900 break-all">{value}</td>
          </tr>
        ))}
        <tr>
          <td className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100 w-1/4 text-sm">Status</td>
          <td className="px-4 py-2 border-b border-gray-100 text-sm">
            <div className="flex items-center gap-2">
              {statusBadge(details.oldStatus)}
              <span className="text-gray-400">→</span>
              {statusBadge(details.newStatus)}
            </div>
          </td>
        </tr>
        {details.reason && (
          <tr>
            <td className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100 w-1/4 text-sm">Rejection reason</td>
            <td className="px-4 py-2 border-b border-gray-100 text-sm text-gray-900 break-words">{details.reason}</td>
          </tr>
        )}
      </>
    );
  };

  const renderDiffTable = (before, after) => {
    const rows = [];

    const addRow = (label, bVal, aVal) => {
      const valB = bVal || "--";
      const valA = aVal || "--";
      if (valB === valA) return;
      rows.push(
        <tr key={label}>
          <td className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100 w-1/4 text-sm">{label}</td>
          <td className="px-4 py-2 text-gray-500 border-b border-gray-100 text-sm w-3/8">{valB}</td>
          <td className="px-4 py-2 border-b border-gray-100 text-sm font-medium w-3/8 bg-yellow-50 text-gray-900">{valA}</td>
        </tr>
      );
    };

    addRow("Title", before.title, after.title);
    addRow("Subject", before.subject, after.subject);
    addRow("Category", before.category, after.category);
    addRow("Year", before.year, after.year);
    addRow("Version", before.version, after.version);

    const addedFiles = after.files.filter(f => !before.files.includes(f));
    const removedFiles = before.files.filter(f => !after.files.includes(f));

    if (addedFiles.length > 0 || removedFiles.length > 0) {
      rows.push(
        <tr key="files">
          <td className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100 align-top w-1/4 text-sm">Files</td>
          <td className="px-4 py-2 border-b border-gray-100 align-top w-3/8">
            <div className="flex flex-col gap-1">
              {before.files.map((f, i) => (
                <span key={i} className={`text-xs font-mono break-all px-2 py-1 rounded ${removedFiles.includes(f) ? 'bg-red-50 text-red-600 line-through border border-red-100' : 'bg-gray-50 text-gray-600'}`}>
                  {f}
                </span>
              ))}
              {before.files.length === 0 && <span className="text-gray-400">--</span>}
            </div>
          </td>
          <td className="px-4 py-2 border-b border-gray-100 align-top bg-yellow-50/30 w-3/8">
            <div className="flex flex-col gap-1">
              {after.files.map((f, i) => (
                <span key={i} className={`text-xs font-mono break-all px-2 py-1 rounded ${addedFiles.includes(f) ? 'bg-green-100 text-green-800 font-bold border border-green-200' : 'bg-gray-50 text-gray-600'}`}>
                  {addedFiles.includes(f) ? `+ ${f}` : f}
                </span>
              ))}
            </div>
          </td>
        </tr>
      );
    }

    return rows.length > 0 ? rows : (
      <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500 italic">No field changes recorded.</td></tr>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <AutoTranslate>Change History</AutoTranslate>
              {title && <span className="text-sm font-normal text-gray-500">- {title}</span>}
            </h2>
            {currentUserRole && (
              <p className="text-xs text-gray-500 mt-1">
                Viewing as: <span className="font-semibold text-indigo-600">{currentUserRole}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-200">
            <MdOutlineClose size={24} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-600">Filter by:</span>
          <div className="flex gap-2">
            {["all", "files", "metadata", "status"].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setCurrentPage(1); }}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-sm text-gray-500">{filteredEvents.length} visible events</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {loading && <div className="text-center py-10 text-gray-500">Loading...</div>}

          {error && !loading && (
            <div className="text-center py-10 text-red-500">{error}</div>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
              <span className="text-2xl block mb-2">🔒</span>
              No history events found for your role and filter.
            </div>
          )}

          <div className="flex flex-col space-y-3">
            {paginatedEvents.map((event) => {
              const { log, details, before, after, isCreation, isStatusChange } = event;
              const meta = getMeta(log, details || {});
              const isExpanded = expandedLogId === log.logId;

              return (
                <div key={log.logId} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.logId)}
                    className="flex flex-wrap items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 gap-2 select-none"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-700">🕒 {fmt(log.createdAt)}</span>
                      <span className="text-sm text-gray-600">by <strong className="text-gray-800">{log.employeeName || "Unknown"}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-gray-400 text-lg">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 overflow-x-auto">
                      {isStatusChange ? (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#1e293b] text-white text-xs uppercase tracking-wider">
                              <th className="px-4 py-2 font-medium w-1/4">Field</th>
                              <th className="px-4 py-2 font-medium">Details</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {renderStatusTable(details || {}, log)}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#1e293b] text-white text-xs uppercase tracking-wider">
                              <th className="px-4 py-2 font-medium w-1/4">Field</th>
                              <th className="px-4 py-2 font-medium w-3/8">Before</th>
                              <th className="px-4 py-2 font-medium w-3/8">After</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {renderDiffTable(before, after, isCreation)}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-gray-600">
              Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredEvents.length)}</strong> of <strong>{filteredEvents.length}</strong> events
            </span>
            <div className="flex gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Previous</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 border rounded text-sm ${currentPage === i + 1 ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 hover:bg-gray-50"}`}>{i + 1}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryModal;