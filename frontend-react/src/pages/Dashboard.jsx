import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import StatCard from "../components/StatCard";
import ParkingSlot from "../components/ParkingSlot";
import ActivityItem from "../components/ActivityItem";
import {
  statsService,
  slotsService,
  logsService,
  commandsService,
} from "../services";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [slots, setSlots] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, slotsData, activityData] = await Promise.all([
        statsService.get(),
        slotsService.getAll(),
        logsService.getRecent(20),
      ]);
      setStats(statsData);
      setSlots(slotsData);
      setRecentActivity(activityData);
      setError(null);
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot) => {
    let message = `Slot #${slot.slot_id}\nStatus: ${slot.status}`;
    if (slot.current_card_uid) {
      message += `\nCard: ${slot.current_card_uid}`;
      if (slot.entry_time) {
        const duration = Math.floor(
          (new Date() - new Date(slot.entry_time)) / 60000
        );
        message += `\nDuration: ${duration} minutes`;
      }
    }
    alert(message);
  };

  const handleEmergency = async () => {
    if (
      window.confirm("Activate emergency mode? This will open all barriers.")
    ) {
      try {
        await commandsService.emergencyMode(true);
        alert("Emergency mode activated!");
        loadDashboardData();
      } catch (err) {
        alert("Failed to activate emergency mode");
      }
    }
  };

  const handleOpenBarrier = async (gate) => {
    try {
      await commandsService.openBarrier(gate);
      alert(`${gate} barrier opened!`);
    } catch (err) {
      alert(`Failed to open ${gate} barrier`);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Slots"
          value={stats?.occupancy?.total_slots || 0}
          icon={BarChart3}
          bgColor="bg-accent-50"
          iconColor="text-accent-600"
        />
        <StatCard
          title="Available"
          value={stats?.occupancy?.available_slots || 0}
          icon={CheckCircle}
          bgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          title="Occupied"
          value={stats?.occupancy?.occupied_slots || 0}
          icon={AlertTriangle}
          bgColor="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Today's Revenue"
          value={`$${stats?.revenue?.today?.toFixed(2) || "0.00"}`}
          icon={DollarSign}
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parking Slots */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Parking Slots
              </h2>
              <button
                onClick={handleEmergency}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center space-x-2"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Emergency</span>
              </button>
            </div>
            <div className="p-6">
              <div className="parking-grid">
                {slots.map((slot) => (
                  <ParkingSlot
                    key={slot.slot_id}
                    slot={slot}
                    onClick={handleSlotClick}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Activity
              </h2>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
              <ul className="space-y-3">
                {recentActivity.length === 0 ? (
                  <li className="text-sm text-slate-500">No recent activity</li>
                ) : (
                  recentActivity.map((log, index) => (
                    <ActivityItem key={index} log={log} />
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Barrier Control */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h5 className="text-lg font-semibold text-slate-900 mb-4">
          Manual Barrier Control
        </h5>
        <div className="flex space-x-3">
          <button
            onClick={() => handleOpenBarrier("entrance")}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
          >
            Open Entrance
          </button>
          <button
            onClick={() => handleOpenBarrier("exit")}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
          >
            Open Exit
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
