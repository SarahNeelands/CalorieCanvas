// src/App.jsx
import React from "react";
import "./App.css";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Meals from "./pages/Meals";
import Exercises from "./pages/Exercises";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import NewIngredient from "./pages/NewIngredient";
import LogMeal from "./pages/LogMeal";
import SnackDetails  from "./pages/SnackDetails";
import DefaultImage from "./components/images/defaultprofile.png"
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProfileSetup from './pages/ProfileSetup';
// Example: this would come from your DB call in a real app
const mockUser = {
  avatar: DefaultImage,
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
        <Route path="/meals" element={<Meals user={mockUser} />} />
        <Route path="/meals/log" element={<Meals user={mockUser} />} />
        <Route path="/exercises" element={<Exercises user={mockUser}/>} />
        <Route path="/exercises/log" element={<Exercises user={mockUser} />} />
        <Route path="/progress" element={<Progress user={mockUser} />} />
        <Route path="/profile" element={<Profile user={mockUser} />} />
        <Route path="/meals/log" element={<LogMeal user={mockUser} />} />
        <Route path="/ingredients/new" element={<NewIngredient user={mockUser} />} />
        <Route path="/meals" element={<Meals user={mockUser} />} />
        <Route path="/meals/log" element={<LogMeal user={mockUser} />} />         {/* existing builder */}
        <Route path="/meals/new" element={<LogMeal user={mockUser} />} />         {/* create new meal via details flow */}
        <Route path="/ingredients/new" element={<NewIngredient user={mockUser} />} />
        <Route path="/snacks/new" element={<SnackDetails user={mockUser} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />

      </Routes>
    </BrowserRouter>
  );
}
