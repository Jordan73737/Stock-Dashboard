import React, { useState, useEffect } from "react";
import axios from "axios";

const TradeSidebar = ({ isOpen, onClose, stock, mode }) => {
  const [investAmount, setInvestAmount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [balance, setBalance] = useState(0);
  const [userHoldings, setUserHoldings] = useState(0);
  const [price, setPrice] = useState(0);

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

    const extractedPrice = stock
      ? parseFloat(
          (mode === "buy" ? stock.sell : stock.buy)?.replace("$", "")
        ) || 0
      : 0;

    setPrice(extractedPrice);
    fetchData();
  }, [stock, mode]);

  const quantity = price > 0 ? investAmount / price : 0;
  const roundedQty = Math.floor(quantity * 10000) / 10000;

  const handleSubmit = async () => {
    try {
      if (mode === "buy" && investAmount > balance) {
        setFeedback("Insufficient funds");
        return;
      }

      if (mode === "sell" && roundedQty > userHoldings) {
        setFeedback("You don't own that many");
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

      window.dispatchEvent(new Event("balanceUpdated"));
      onClose();
    } catch (err) {
      setFeedback("Transaction failed");
      console.error(err);
    }
  };

  if (!isOpen || !stock) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="bg-white w-96 h-full p-6 shadow-lg z-50">
        <h2 className="text-xl font-bold mb-4">
          {mode === "buy" ? "Buy" : "Sell"} {stock.name} ({stock.symbol})
        </h2>

        <div className="mb-4">
          <label className="block font-medium mb-1">
            {mode === "buy" ? "Investment Amount ($)" : "Amount to Sell"}
          </label>
          <input
            type="range"
            min="0"
            max={
              Number.isFinite(mode === "buy" ? balance : userHoldings * price)
                ? mode === "buy"
                  ? balance
                  : userHoldings * price
                : 0
            }
            step="0.01"
            value={investAmount}
            onChange={(e) => setInvestAmount(parseFloat(e.target.value) || 0)}
            className="w-full"
          />
          <div className="text-sm mt-1">
            <p>
              {mode === "buy"
                ? `$${
                    Number.isFinite(investAmount)
                      ? investAmount.toFixed(2)
                      : "0.00"
                  } = ${Number.isFinite(roundedQty) ? roundedQty : 0} shares`
                : `${Number.isFinite(roundedQty) ? roundedQty : 0} shares = $${
                    Number.isFinite(roundedQty * price)
                      ? (roundedQty * price).toFixed(2)
                      : "0.00"
                  }`}
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

        <button
          onClick={handleSubmit}
          className={`w-full py-2 rounded text-white mt-2 ${
            (mode === "buy" && investAmount > balance) ||
            (mode === "sell" && roundedQty > userHoldings)
              ? "bg-gray-400 cursor-not-allowed"
              : mode === "buy"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
          disabled={
            (mode === "buy" && investAmount > balance) ||
            (mode === "sell" && roundedQty > userHoldings)
          }>
          Confirm {mode === "buy" ? "Purchase" : "Sale"}
        </button>
      </div>
    </div>
  );
};

export default TradeSidebar;
