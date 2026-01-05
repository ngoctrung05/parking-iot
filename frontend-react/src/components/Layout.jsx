import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { wsService } from "../services/websocket";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [wsStatus, setWsStatus] = useState("disconnected");

  useEffect(() => {
    const handleConnection = (data) => {
      setWsStatus(data?.status || "disconnected");
    };

    // Listen for connection status BEFORE connecting (avoid race)
    wsService.on("connection", handleConnection);

    // Set initial status in case we're already connected
    setWsStatus(wsService.isConnected() ? "connected" : "disconnected");

    // Connect to WebSocket
    wsService.connect();

    return () => {
      wsService.off("connection", handleConnection);
      wsService.disconnect();
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/cards", label: "Cards" },
    { path: "/logs", label: "Logs" },
    { path: "/reports", label: "Reports" },
    { path: "/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-8">
              <Link
                to="/"
                className="flex items-center space-x-2 text-slate-900 font-semibold text-lg"
              >
                <svg
                  className="w-6 h-6 text-accent-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <span>IoT Parking</span>
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        isActive
                          ? "text-accent-600 border-accent-600"
                          : "text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === "connected"
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                ></span>
                <span className="text-slate-600 font-medium">
                  {wsStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
