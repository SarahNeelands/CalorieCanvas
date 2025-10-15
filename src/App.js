// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Meals from "./pages/Meals";
import Exercises from "./pages/Exercises";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";

// Example: this would come from your DB call in a real app
const mockUser = {
  avatar: "/cc/avatar.png",
  dailyGoal: 2000,
  today: {
    kcalEaten: 1200,
    meals: [
      { id: 1, title: "Oatmeal with Berries", time: "10:30 AM", kcal: 350 },
      { id: 2, title: "Grilled Chicken Salad", time: "1:15 PM", kcal: 450 },
      { id: 3, title: "Salmon with Roasted Vegetables", time: "7:00 PM", kcal: 600 },
      { id: 4, title: "Apple", time: "9:15 PM", kcal: 95 },
    ],
  },
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard user={mockUser} />} />
        <Route path="/meals" element={<Meals />} />
        <Route path="/meals/log" element={<Meals />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/log" element={<Exercises />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}
