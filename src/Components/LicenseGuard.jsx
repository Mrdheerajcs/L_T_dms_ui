import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { licenseApi } from "../API/licenseApi";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

const LicenseGuard = ({ children }) => {
  const [state, setState] = useState({ loading: true, status: null });

  useEffect(() => {
    (async () => {
      try {
        const res = await licenseApi.getStatus();
        setState({ loading: false, status: res.status });
      } catch (e) {
        setState({ loading: false, status: "ERROR" });
      }
    })();
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ArrowPathIcon className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (state.status === "NOT_ACTIVATED") {
    return <Navigate to="/activate" replace />;
  }

  return children;
};

export default LicenseGuard;