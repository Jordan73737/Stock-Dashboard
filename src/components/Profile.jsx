import React, { useEffect, useState } from "react";
import axios from "axios";
import TradeSidebar from "./TradeSidebar";
import ValueHistoryChart from "./ValueHistoryChart";

const Profile = () => {
  const [balance, setBalance] = useState(0);
  const [inputBalance, setInputBalance] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeMode, setTradeMode] = useState(null);
  const [depositMessage, setDepositMessage] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");

  const openTradeSidebar = (stock, mode) => {
    setSelectedStock(stock);
    setTradeMode(mode);
  };

  const closeSidebar = () => {
    setSelectedStock(null);
    setTradeMode(null);
  };

  const triggerSnapshot = async () => {
  try {
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/run-daily-snapshot`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
  } catch (err) {
    console.warn("Snapshot trigger failed", err);
  }
};


  const fetchProfileData = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const [balanceRes, holdingsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/holdings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const enrichedHoldings = await Promise.all(
        holdingsRes.data.map(async (holding) => {
          try {
            const quoteRes = await axios.get(
              `https://finnhub.io/api/v1/quote?symbol=${holding.symbol}`,
              {
                params: {
                  token: import.meta.env.VITE_FINNHUB_API_KEY,
                },
              }
            );

            const currentPrice = quoteRes.data.c;
            const currentValue = currentPrice * holding.quantity;
            const originalCost = holding.buy_price * holding.quantity;
            const profitLoss = currentValue - originalCost;

            return {
              ...holding,
              currentPrice,
              currentValue,
              profitLoss,
            };
          } catch {
            return {
              ...holding,
              currentPrice: 0,
              currentValue: 0,
              profitLoss: 0,
            };
          }
        })
      );

      setBalance(balanceRes.data.balance);
      setHoldings(enrichedHoldings);
    } catch (err) {
      console.error("Error fetching profile data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    const depositAmount = parseFloat(inputBalance);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a positive amount.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
        { balance: Number(balance) + Number(inputBalance) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (Number(inputBalance) <= 0) {
        alert("Please enter a positive number to deposit.");
        return;
      }

      setInputBalance(""); // Clear the input
      setDepositMessage(`Successfully deposited $${depositAmount.toFixed(2)}`);
      await triggerSnapshot();
      window.dispatchEvent(new Event("balanceUpdated"));

      window.dispatchEvent(new Event("balanceUpdated"));
      fetchProfileData(); // Refresh balance on screen
    } catch (err) {
      console.error("Failed to deposit funds", err);
      alert("Failed to deposit. Try again.");
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawMessage("Please enter a positive number.");
      return;
    }

    if (amount > balance) {
      setWithdrawMessage("Insufficient funds to withdraw.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      // Subtract from balance
      const newBalance = Number(balance) - amount;

      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
        { balance: newBalance },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setWithdrawAmount(""); // Clear input
      setWithdrawMessage(`Successfully withdrew £${amount.toFixed(2)}`);
      await triggerSnapshot();
      window.dispatchEvent(new Event("balanceUpdated"));
      setBalance(newBalance); // Update UI state
      window.dispatchEvent(new Event("balanceUpdated"));
    } catch (err) {
      console.error("Failed to withdraw funds", err);
      setWithdrawMessage("Failed to withdraw. Try again.");
    }
  };

  // Already Using The Sidebar To Handle Selling
  // const handleSell = async (symbol) => {
  //   const token = localStorage.getItem("token");
  //   try {
  //     await axios.post(
  //       `${import.meta.env.VITE_API_BASE_URL}/api/sell`,
  //       { symbol, quantity: 1 },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     window.dispatchEvent(new Event("balanceUpdated"));
  //     fetchProfileData();
  //   } catch (err) {
  //     alert("Error selling stock.");
  //   }
  // };

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    fetchProfileData(); // initial fetch

    const listener = () => fetchProfileData();
    window.addEventListener("holdingsUpdated", listener);

    return () => window.removeEventListener("holdingsUpdated", listener);
  }, []);

  useEffect(() => {
    const handleBalanceUpdate = () => {
      fetchProfileData();
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);
    return () =>
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Your Profile</h2>

      {/* Deposit + Withdraw Row */}
      <div className="flex flex-wrap items-start gap-4 mb-4">
        {/* Deposit Section */}
        <div>
          <p className="mb-2 font-medium">
            Current Balance: £{Number(balance || 0).toFixed(2)}
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={inputBalance}
            onChange={(e) => setInputBalance(e.target.value)}
            placeholder="Enter deposit amount"
            className="border px-2 py-1 mr-2"
          />
          <button
            onClick={handleDeposit}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">
            Deposit
          </button>
          {depositMessage && (
            <p className="text-green-600 mt-2 text-sm">{depositMessage}</p>
          )}
        </div>

        {/* Withdraw Section */}
        <div>
          <p className="mb-2 font-medium invisible">Spacer</p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter withdraw amount"
            className="border px-2 py-1 mr-2"
          />
          <button
            onClick={handleWithdraw}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
            Withdraw
          </button>
          {withdrawMessage && (
            <p className="text-red-600 mt-2 text-sm">{withdrawMessage}</p>
          )}
        </div>
      </div>

      {successMessage && (
        <p className="text-green-600 mb-4 text-center font-medium">
          {successMessage}
        </p>
      )}

      <h3 className="text-xl font-semibold mt-6 mb-2">Your Holdings</h3>

      {loading ? (
        <p>Loading holdings...</p>
      ) : holdings.length === 0 ? (
        <p className="text-gray-500">No holdings found.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4">Symbol</th>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Qty</th>
              <th className="py-2 px-4">Buy Price</th>
              <th className="py-2 px-4">Current Price</th>
              <th className="py-2 px-4">Profit/Loss</th>
              <th className="py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((stock, index) => (
              <tr key={index} className="border-b">
                <td className="py-2 px-4">{stock.symbol}</td>
                <td className="py-2 px-4">{stock.name}</td>
                <td className="py-2 px-4">{stock.quantity}</td>
                <td className="py-2 px-4">
                  ${Number(stock.buy_price).toFixed(2)}
                </td>
                <td className="py-2 px-4">
                  ${Number(stock.currentPrice).toFixed(2)}
                </td>
                <td
                  className={`py-2 px-4 font-semibold ${
                    stock.profitLoss > 0
                      ? "text-green-600"
                      : stock.profitLoss < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                  ${Number(stock.profitLoss).toFixed(2)}
                </td>

                <td className="py-2 px-4">
                  <button
                    onClick={() =>
                      openTradeSidebar(
                        {
                          ...stock,
                          sell: `$${Number(stock.currentPrice).toFixed(2)}`,
                        },
                        "sell"
                      )
                    }
                    className="bg-red-600 text-white px-3 py-1 rounded">
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ValueHistoryChart filter="daily" />
      <TradeSidebar
        isOpen={!!selectedStock}
        onClose={closeSidebar}
        stock={selectedStock}
        mode={tradeMode}
        onSuccess={async (msg) => {
          console.log(msg);
          setSuccessMessage(msg);
          await triggerSnapshot();
          fetchProfileData();
          window.dispatchEvent(new Event("balanceUpdated")); // Triggers profile/home update
        }}
      />
    </div>
  );
};

export default Profile;
