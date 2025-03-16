// components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../slices/authSlice";

const Navbar = () => {
  const { isAuthenticated, username } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md p-4 sticky top-0 w-full">
      <div className="container mx-auto flex justify-between items-center">
        <div className="font-bold text-xl text-blue-600">StockDash</div>
        <div className="flex space-x-4 items-center">
          {isAuthenticated ? (
            <>
              <span className="text-gray-600">Welcome, {username}</span>
              <Link
                to="/dashboard"
                className="hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hover:text-blue-600 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hover:text-blue-600 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="hover:text-blue-600 transition-colors"
              >
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
