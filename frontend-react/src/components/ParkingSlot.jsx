import React from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";

const ParkingSlot = ({ slot, onClick }) => {
  const isAvailable = slot.status === "available";

  return (
    <div
      onClick={() => onClick(slot)}
      className={`aspect-square rounded-xl border-2 flex flex-col justify-center items-center cursor-pointer transition-all ${
        isAvailable
          ? "border-slate-200 bg-white hover:border-accent-500 hover:shadow-md"
          : "border-accent-500 bg-accent-50 text-accent-700"
      }`}
    >
      {isAvailable ? (
        <CheckCircle className="w-8 h-8 text-slate-400" />
      ) : (
        <AlertTriangle className="w-8 h-8" />
      )}
      <div className="text-xl font-semibold mt-2">{slot.slot_id}</div>
      <div
        className={`text-xs uppercase tracking-wide font-medium ${
          isAvailable ? "text-slate-500" : "text-accent-600"
        }`}
      >
        {isAvailable ? "Free" : "Occupied"}
      </div>
    </div>
  );
};

export default ParkingSlot;
