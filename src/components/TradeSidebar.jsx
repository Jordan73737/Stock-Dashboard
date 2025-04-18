import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const TradeSidebar = ({ isOpen, onClose, stock, mode, onSuccess }) => {
  const [investAmount, setInvestAmount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [balance, setBalance] = useState(0);
  const [userHoldings, setUserHoldings] = useState(0);
  const [price, setPrice] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      if (!token || !stock?.symbol) return;

      try {
        const balanceRes = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBalance(Number(balanceRes.data.balance) || 0);

        const holdingsRes = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/holdings`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const matched = holdingsRes.data.find((h) => h.symbol === stock.symbol);
        setUserHoldings(Number(matched?.quantity) || 0);
      } catch (err) {
        console.error("Failed to fetch sidebar data", err);
      }
    };

    setFeedback("");
    setInvestAmount(0);
    setSuccessMessage("");

    const extractedPrice = stock
      ? parseFloat(
          (mode === "sell"
            ? stock.sell?.replace?.("£", "") // <-- fallback
            : stock.sell?.replace?.("£", "")) || 0
        )
      : 0;

    setPrice(extractedPrice);
    fetchData();
    window.addEventListener("holdingsUpdated", fetchData);
    return () => window.removeEventListener("holdingsUpdated", fetchData);
  }, [stock, mode]);

  const rawQty = useMemo(() => {
    return price > 0 ? investAmount / price : 0;
  }, [investAmount, price]);

  const roundedQty = useMemo(() => {
    return Math.floor(rawQty * 10000) / 10000;
  }, [rawQty]);

  const handleSubmit = async () => {
    try {
      if (
        mode === "buy" &&
        (investAmount <= 0 || roundedQty <= 0 || roundedQty * price > balance)
      ) {
        setFeedback("Insufficient funds or invalid amount.");
        return;
      }

      if (mode === "sell" && (roundedQty <= 0 || roundedQty > userHoldings)) {
        setFeedback("You don't own that many or quantity is invalid.");
        return;
      }

      const endpoint =
        mode === "buy"
          ? `${import.meta.env.VITE_API_BASE_URL}/api/holdings/buy`
          : `${import.meta.env.VITE_API_BASE_URL}/api/holdings/sell`;

      const payload =
        mode === "buy"
          ? {
              symbol: stock.symbol,
              name: stock.name,
              quantity: roundedQty,
              buy_price: price,
            }
          : {
              symbol: stock.symbol,
              quantity: roundedQty,
            };

      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const msg =
        mode === "buy"
          ? `Purchased ${roundedQty} shares of ${
              stock.symbol
            } for £${investAmount.toFixed(2)}`
          : `${roundedQty} shares of ${stock.symbol} sold for £${(
              roundedQty * price
            ).toFixed(2)}`;

      setSuccessMessage(msg);
      window.dispatchEvent(new Event("balanceUpdated"));
      window.dispatchEvent(new Event("holdingsUpdated"));
      onSuccess?.(msg);
    } catch (err) {
      setFeedback("Transaction failed");
      console.error(err);
    }
  };
  const sliderMax = useMemo(() => {
    return mode === "buy" ? balance : userHoldings * price;
  }, [mode, balance, userHoldings, price]);

  const sliderStep = useMemo(() => {
    // Allow fine granularity when holdings are small
    return sliderMax < 10 ? 0.0001 : 0.01;
  }, [sliderMax]);

  if (!isOpen || !stock) return null;

  const maxSliderValue =
    mode === "buy"
      ? balance > 0
        ? balance.toFixed(2)
        : 0
      : userHoldings > 0 && price > 0
      ? (userHoldings * price).toFixed(2)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="bg-white w-96 h-full p-6 shadow-lg z-50">
        <h2 className="text-xl font-bold mb-4">
          {mode === "buy" ? "Buy" : "Sell"} {stock.name} ({stock.symbol})
        </h2>

        <div className="mb-4">
          <label className="block font-medium mb-1">
            {mode === "buy" ? "Investment Amount (£)" : "Amount to Sell"}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={investAmount}
            onChange={(e) => setInvestAmount(parseFloat(e.target.value) || 0)}
            className="w-full border px-2 py-1 mb-2"
            placeholder="Enter amount in £"
          />

          <input
            type="range"
            min={0}
            max={sliderMax}
            step={sliderStep}
            value={Number(investAmount)}
            onChange={(e) => setInvestAmount(parseFloat(e.target.value) || 0)}
            className="w-full"
          />

          <div className="text-sm mt-1">
            <p>
              {Number.isFinite(roundedQty) && Number.isFinite(investAmount)
                ? mode === "buy"
                  ? `£${investAmount.toFixed(2)} = ${roundedQty} shares`
                  : `${roundedQty} shares = £${(roundedQty * price).toFixed(2)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="mb-2 text-sm">
          <p>
            {mode === "buy" ? "Balance" : "Holdings"}:{" "}
            <strong>
              {mode === "buy"
                ? `$${Number.isFinite(balance) ? balance.toFixed(2) : "0.00"}`
                : Number.isFinite(userHoldings)
                ? userHoldings
                : 0}
            </strong>
          </p>
        </div>

        {feedback && <p className="text-red-500 text-sm mb-2">{feedback}</p>}
        {successMessage && (
          <p className="text-green-600 text-sm mb-2 text-center">
            {successMessage}
          </p>
        )}

        <button
          onClick={handleSubmit}
          className={`w-full py-2 rounded text-white mt-2 ${
            (mode === "buy" && (investAmount > balance || investAmount <= 0)) ||
            (mode === "sell" && (roundedQty > userHoldings || roundedQty <= 0))
              ? "bg-gray-400 cursor-not-allowed"
              : mode === "buy"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
          disabled={
            (mode === "buy" && (investAmount > balance || investAmount <= 0)) ||
            (mode === "sell" && (roundedQty > userHoldings || roundedQty <= 0))
          }>
          Confirm {mode === "buy" ? "Purchase" : "Sale"}
        </button>
      </div>
    </div>
  );
};

export default TradeSidebar;
