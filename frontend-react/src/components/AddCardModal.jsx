import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { commandsService } from "../services";
import { wsService } from "../services/websocket";

const AddCardModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    card_uid: "",
    owner_name: "",
    owner_email: "",
    phone: "",
    vehicle_plate: "",
    access_level: "regular",
  });

  const [scanStatus, setScanStatus] = useState("idle"); // idle | scanning
  const [scanError, setScanError] = useState(null);

  const formatApiDetail = (detail) => {
    if (!detail) return null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || JSON.stringify(item))
        .join("; ");
    }
    if (typeof detail === "object") {
      return detail?.msg || detail?.message || JSON.stringify(detail);
    }
    return String(detail);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!isOpen) {
      setScanStatus("idle");
      setScanError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleWsMessage = (msg) => {
      // Expecting backend websocket message: { type: 'mqtt_message', data: { topic, data } }
      const topic = msg?.data?.topic;
      const payload = msg?.data?.data;

      if (topic !== "parking/events/scan") return;
      const scannedUid = payload?.card_uid;
      if (!scannedUid) return;

      // Only auto-fill when modal is open and user explicitly started scanning.
      if (!isOpen || scanStatus !== "scanning") return;

      setFormData((prev) => ({
        ...prev,
        card_uid: String(scannedUid).toUpperCase().trim(),
      }));
      setScanStatus("idle");
      setScanError(null);

      // Best-effort: turn off scan mode once we got a UID
      commandsService.scanMode(false, "entrance").catch(() => {});
    };

    wsService.on("mqtt_message", handleWsMessage);
    return () => wsService.off("mqtt_message", handleWsMessage);
  }, [isOpen, scanStatus]);

  const handleScanCard = async () => {
    if (scanStatus === "scanning") return;
    setScanError(null);
    setScanStatus("scanning");

    if (!wsService.isConnected()) {
      setScanStatus("idle");
      setScanError(
        "WebSocket is disconnected. Please make sure the app shows Connected in the top-right."
      );
      return;
    }

    try {
      await commandsService.scanMode(true, "entrance");
    } catch (err) {
      setScanStatus("idle");
      setScanError(
        formatApiDetail(err?.response?.data?.detail) ||
          err?.message ||
          "Failed to start scan mode"
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      card_uid: formData.card_uid.toUpperCase().trim(),
      owner_name: formData.owner_name.trim(),
      owner_email: formData.owner_email.trim() || null,
      phone: formData.phone.trim() || null,
      vehicle_plate: formData.vehicle_plate.trim() || null,
    });
    setScanStatus("idle");
    setScanError(null);
    setFormData({
      card_uid: "",
      owner_name: "",
      owner_email: "",
      phone: "",
      vehicle_plate: "",
      access_level: "regular",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Add New Card
              </h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Card UID *
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    name="card_uid"
                    value={formData.card_uid}
                    onChange={handleChange}
                    required
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                    placeholder="ABCD1234"
                  />
                  <button
                    type="button"
                    onClick={handleScanCard}
                    disabled={scanStatus === "scanning"}
                    className="px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Activate scan mode and tap a card"
                  >
                    {scanStatus === "scanning" ? "Scanning..." : "Scan Card"}
                  </button>
                </div>

                {scanStatus === "scanning" && (
                  <p className="mt-2 text-xs text-slate-600">
                    Scan mode is active. Tap a card on the entrance reader to
                    fill UID.
                  </p>
                )}

                {scanError && (
                  <p className="mt-2 text-xs text-red-600">{scanError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Owner Name *
                </label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="owner_email"
                  value={formData.owner_email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vehicle Plate
                </label>
                <input
                  type="text"
                  name="vehicle_plate"
                  value={formData.vehicle_plate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                  placeholder="ABC-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Access Level
                </label>
                <select
                  name="access_level"
                  value={formData.access_level}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                >
                  <option value="regular">Regular</option>
                  <option value="admin">Admin</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCardModal;
