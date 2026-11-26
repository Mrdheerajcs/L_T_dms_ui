import React, { useEffect, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { licenseApi } from "../API/licenseApi";

const LicenseBanner = () => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await licenseApi.getStatus();
        setInfo(res);
      } catch (e) {}
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!info) return null;
  if (info.status === "NOT_ACTIVATED") return null;
  if (info.status === "ACTIVE" && info.daysUntilExpiry > 15) return null;

  let bg, text;
  if (info.status === "EXPIRED" || info.status === "REVOKED") {
    bg = "bg-red-600";
    text = `License ${info.status.toLowerCase()}. System is in READ-ONLY mode. Contact support.`;
  } else if (info.status === "GRACE") {
    bg = "bg-orange-600";
    text = `License expired. Grace period active. Please renew.`;
  } else {
    bg = "bg-yellow-500";
    text = `License expires in ${info.daysUntilExpiry} day(s). Please renew soon.`;
  }

  return (
    <div className={`${bg} text-white px-4 py-2 text-sm flex items-center justify-center gap-2`}>
      <ExclamationTriangleIcon className="w-5 h-5" />
      <span>{text}</span>
    </div>
  );
};

export default LicenseBanner;