import React from "react";
import { format } from "date-fns";
import { LogIn, LogOut } from "lucide-react";

const ActivityItem = ({ log }) => {
  const isEntry = log.action === "entry";
  const isSuccess = log.status === "success";

  const borderColor = isSuccess
    ? isEntry
      ? "border-green-500"
      : "border-blue-500"
    : "border-red-500";

  const iconColor = isSuccess
    ? isEntry
      ? "text-green-600"
      : "text-blue-600"
    : "text-red-600";

  const statusBadge = isSuccess
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";

  const Icon = isEntry ? LogIn : LogOut;

  return (
    <li className={`border-l-4 ${borderColor} pl-3 py-2 bg-white rounded-r`}>
      <div className="flex items-start space-x-2">
        <div className={`${iconColor} mt-0.5`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-900">
              {log.action.toUpperCase()}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}
            >
              {log.status}
            </span>
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-mono">{log.card_uid}</span>
            {log.slot_id && <span> • Slot {log.slot_id}</span>}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {format(new Date(log.timestamp), "PPp")}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ActivityItem;
