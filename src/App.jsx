import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";

// Components
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import RecoverPassword from "./components/RecoverPassword";
import ResetPassword from "./components/ResetPassword";
import Home from "./components/Home";

// Redux actions
import {
  fetchFavorites,
  setSearchResults,
  setIsSearching,
} from "./slices/stocksSlice";

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />

        <main className="container mx-auto mt-10 px-4">
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/home" />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                isAuthenticated ? <Dashboard /> : <Navigate to="/login" />
              }
            />
            <Route path="/profile" element={<Profile />} />
            <Route path="/recover" element={<RecoverPassword />} />
            <Route path="/reset/:token" element={<ResetPassword />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
