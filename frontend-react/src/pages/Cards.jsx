import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Play, Pause, RefreshCw } from "lucide-react";
import AddCardModal from "../components/AddCardModal";
import EditCardModal from "../components/EditCardModal";
import { cardsService, commandsService } from "../services";

const Cards = () => {
  const [cards, setCards] = useState([]);
  const [unknownCards, setUnknownCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [notification, setNotification] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const formatApiDetail = (detail) => {
    if (!detail) return null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // FastAPI/Pydantic validation errors: [{loc, msg, type, ...}, ...]
      return detail
        .map((item) => item?.msg || item?.message || JSON.stringify(item))
        .join("; ");
    }
    if (typeof detail === "object") {
      return detail?.msg || detail?.message || JSON.stringify(detail);
    }
    return String(detail);
  };

  const formatApiError = (err, fallback) => {
    const detail = formatApiDetail(err?.response?.data?.detail);
    return detail || err?.message || fallback;
  };

  useEffect(() => {
    loadCards();
    loadUnknownCards();
    const interval = setInterval(() => {
      loadCards();
      loadUnknownCards();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadCards = async () => {
    try {
      const data = await cardsService.getAll();
      setCards(data);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnknownCards = async () => {
    try {
      const data = await cardsService.getRecentUnknown();
      setUnknownCards(data);
    } catch (err) {
      console.error("Failed to load unknown cards:", err);
    }
  };

  const handleAddCard = async (cardData) => {
    try {
      await cardsService.create(cardData);
      showNotification("Card added successfully!", "success");
      setIsModalOpen(false);
      loadCards();
      loadUnknownCards();
    } catch (err) {
      showNotification(formatApiError(err, "Failed to add card"), "error");
    }
  };

  const handleToggleStatus = async (cardUid, currentStatus) => {
    try {
      await cardsService.toggleStatus(cardUid, !currentStatus);
      showNotification(
        `Card ${!currentStatus ? "activated" : "deactivated"} successfully!`,
        "success"
      );
      loadCards();
    } catch (err) {
      showNotification("Failed to update card status", "error");
    }
  };

  const handleEditCard = (card) => {
    setEditingCard(card);
    setIsEditModalOpen(true);
  };

  const handleUpdateCard = async (cardUid, updateData) => {
    try {
      await cardsService.update(cardUid, updateData);
      showNotification("Card updated successfully!", "success");
      setIsEditModalOpen(false);
      setEditingCard(null);
      loadCards();
      loadUnknownCards();
    } catch (err) {
      showNotification(formatApiError(err, "Failed to update card"), "error");
    }
  };

  const handleDeleteCard = async (cardUid) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      try {
        await cardsService.delete(cardUid);
        showNotification("Card deleted successfully!", "success");
        loadCards();
      } catch (err) {
        showNotification("Failed to delete card", "error");
      }
    }
  };

  const handleSyncCards = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await commandsService.syncCards();
      showNotification("Synced cards to ESP32 successfully!", "success");
    } catch (err) {
      showNotification(
        formatApiError(err, "Failed to sync cards to ESP32"),
        "error"
      );
    } finally {
      setSyncing(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({
      message: formatApiDetail(message) || String(message),
      type,
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const accessLevelMap = {
    regular: "Regular",
    admin: "Admin",
    temporary: "Temporary",
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
      {notification && (
        <div
          className={`p-4 rounded-lg ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Unknown Cards */}
      {unknownCards.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-3">
            Unknown Cards Detected
          </h3>
          <div className="space-y-2">
            {unknownCards.map((card) => (
              <div
                key={card.card_uid}
                className="flex items-center justify-between bg-white p-3 rounded-lg"
              >
                <div>
                  <code className="font-mono font-semibold">
                    {card.card_uid}
                  </code>
                  <p className="text-xs text-slate-600">
                    Last seen: {new Date(card.last_seen).toLocaleString()} •
                    Attempts: {card.attempt_count}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add Card
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Registered Cards
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncCards}
              disabled={syncing}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors border border-slate-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync active cards to ESP32"
            >
              <RefreshCw
                className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
              />
              <span>{syncing ? "Syncing..." : "Sync to ESP32"}</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Card</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Card UID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Access Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {cards.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-slate-500"
                  >
                    No cards found. Add your first card!
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr key={card.card_uid} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm font-mono">{card.card_uid}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {card.owner_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {card.owner_email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {card.vehicle_plate || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {accessLevelMap[card.access_level] || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          card.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {card.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditCard(card)}
                          className="p-1 text-slate-600 hover:text-slate-800"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleToggleStatus(card.card_uid, card.is_active)
                          }
                          className={`p-1 ${
                            card.is_active
                              ? "text-yellow-600 hover:text-yellow-700"
                              : "text-green-600 hover:text-green-700"
                          }`}
                          title={card.is_active ? "Deactivate" : "Activate"}
                        >
                          {card.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.card_uid)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddCard}
      />

      <EditCardModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCard(null);
        }}
        card={editingCard}
        onSubmit={handleUpdateCard}
      />
    </div>
  );
};

export default Cards;
