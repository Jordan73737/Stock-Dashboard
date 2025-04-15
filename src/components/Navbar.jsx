// components/Navbar.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../slices/authSlice";
import axios from "axios";

const Navbar = () => {
  const { isAuthenticated, email } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);

  // Fetch balance from backend
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setBalance(res.data.balance);
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  };

  // Fetch on mount and set up event listener for real-time updates
  useEffect(() => {
    fetchBalance();

    // Listen for balance update events
    const handleBalanceUpdate = () => {
      fetchBalance();
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);
    return () => {
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
    };
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md p-4 sticky top-0 w-full z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="font-bold text-xl text-blue-600">StockDash</div>
        <div className="flex space-x-4 items-center">
          {isAuthenticated ? (
            <>
              <span className="text-gray-600">Welcome, {email}</span>
              <span className="text-green-600 font-semibold">
                Balance: $
                {balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
              <Link
                to="/home"
                className="hover:text-blue-600 transition-colors">
                Home
              </Link>
              <Link
                to="/dashboard"
                className="hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="hover:text-blue-600 transition-colors">
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="hover:text-blue-600 transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hover:text-blue-600 transition-colors">
                Login
              </Link>
              <Link
                to="/register"
                className="hover:text-blue-600 transition-colors">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
