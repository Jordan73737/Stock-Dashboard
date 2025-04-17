import React, { useState, useEffect } from "react";
import axios from "axios";

const TradeSidebar = ({ isOpen, onClose, stock, mode }) => {
  const [investment, setInvestment] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [balance, setBalance] = useState(0);
  const [userHoldings, setUserHoldings] = useState(0);

  const price = stock
    ? parseFloat((mode === "buy" ? stock.sell : stock.buy).replace("$", ""))
    : 0;

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      if (!token || !stock?.symbol) return;

      const balanceRes = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setBalance(balanceRes.data.balance);

      const holdingsRes = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/holdings`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const matched = holdingsRes.data.find((h) => h.symbol === stock.symbol);
      setUserHoldings(matched ? matched.quantity : 0);
    };

    fetchData();
    setInvestment(0);
    setQuantity(1);
    setFeedback("");
  }, [stock, mode]);

  const handleSubmit = async () => {
    try {
      if (mode === "buy") {
        const qty = parseFloat((investment / price).toFixed(4));

        if (investment > balance || qty <= 0) {
          setFeedback("Insufficient funds or invalid amount");
          return;
        }

        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/holdings`,
          {
            symbol: stock.symbol,
            name: stock.name,
            quantity: qty,
            buy_price: price,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        if (quantity > userHoldings) {
          setFeedback("You don't own that many");
          return;
        }

        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/sell`,
          { symbol: stock.symbol, quantity },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      window.dispatchEvent(new Event("balanceUpdated"));
      onClose();
    } catch (err) {
      console.error(err);
      setFeedback("Transaction failed");
    }
  };

  if (!isOpen || !stock) return null;

  const computedShares = investment / price;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="bg-white w-96 h-full p-6 shadow-lg z-50">
        <h2 className="text-xl font-bold mb-4">
          {mode === "buy" ? "Buy" : "Sell"} {stock.name} ({stock.symbol})
        </h2>

        {mode === "buy" ? (
          <div className="mb-4">
            <label className="block font-medium mb-1">
              How much to invest (£)
            </label>
            <input
              type="range"
              min={0}
              max={balance}
              step={1}
              value={investment}
              onChange={(e) => setInvestment(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="text-sm text-center">
              <p>
                £{investment} ={" "}
                {isNaN(computedShares) ? "0" : computedShares.toFixed(4)} shares
                of {stock.symbol}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block font-medium mb-1">Quantity</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1 bg-gray-200 rounded">
                -
              </button>
              <input
                type="number"
                min={1}
                className="border px-2 py-1 w-20 text-center"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-1 bg-gray-200 rounded">
                +
              </button>
            </div>
          </div>
        )}

        <div className="mb-2 text-sm">
          <p>
            {mode === "buy" ? "Estimated Cost" : "Estimated Proceeds"}:{" "}
            <strong>
              £
              {mode === "buy"
                ? investment.toFixed(2)
                : (quantity * price).toFixed(2)}
            </strong>
          </p>
          <p>
            Your {mode === "buy" ? "Balance" : "Holdings"}:{" "}
            <strong>
              {mode === "buy" ? `£${balance.toFixed(2)}` : userHoldings}
            </strong>
          </p>
        </div>

        {feedback && <p className="text-red-500 text-sm mb-2">{feedback}</p>}

        <button
          onClick={handleSubmit}
          className={`w-full py-2 rounded text-white ${
            (mode === "buy" && investment <= 0) ||
            (mode === "sell" && quantity > userHoldings)
              ? "bg-gray-400 cursor-not-allowed"
              : mode === "buy"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
          disabled={
            (mode === "buy" && investment <= 0) ||
            (mode === "sell" && quantity > userHoldings)
          }>
          Confirm {mode === "buy" ? "Purchase" : "Sale"}
        </button>
      </div>
    </div>
  );
};

export default TradeSidebar;
