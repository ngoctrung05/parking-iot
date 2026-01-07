import React, { useEffect, useState } from "react";
import { settingsService } from "../services";

const Settings = () => {
  const [pricing, setPricing] = useState(null);
  const [form, setForm] = useState({
    hourly_rate: "",
    daily_max_rate: "",
    grace_period_minutes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getPricing();
      setPricing(data);
      setForm({
        hourly_rate: String(data.hourly_rate ?? ""),
        daily_max_rate: String(data.daily_max_rate ?? ""),
        grace_period_minutes: String(data.grace_period_minutes ?? ""),
      });
      setMessage(null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        hourly_rate: Number(form.hourly_rate),
        daily_max_rate: Number(form.daily_max_rate),
        grace_period_minutes: Number(form.grace_period_minutes),
      };

      if (
        Number.isNaN(payload.hourly_rate) ||
        Number.isNaN(payload.daily_max_rate) ||
        Number.isNaN(payload.grace_period_minutes)
      ) {
        setMessage({ type: "error", text: "Please enter valid numbers" });
        return;
      }

      const updated = await settingsService.updatePricing(payload);
      setPricing(updated);
      setMessage({ type: "success", text: "Pricing settings updated" });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.detail ||
          "Failed to update settings (admin only)",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Settings</h2>
        <p className="text-slate-600 text-sm">
          Configure parking fee calculation.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Hourly Rate ($/hour)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="hourly_rate"
              value={form.hourly_rate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Daily Max Rate ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="daily_max_rate"
              value={form.daily_max_rate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Grace Period (minutes)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="grace_period_minutes"
              value={form.grace_period_minutes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              Current:{" "}
              {pricing
                ? `$${pricing.hourly_rate}/h, max $${pricing.daily_max_rate}/day, free ${pricing.grace_period_minutes}m`
                : "-"}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
