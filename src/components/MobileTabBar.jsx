import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./MobileTabBar.css";

const hiddenPrefixes = ["/login", "/signup", "/profile-setup"];

export default function MobileTabBar() {
  const { pathname } = useLocation();

  const isHidden = hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isHidden) {
    return null;
  }

  return (
    <nav className="mobile-tabbar" aria-label="Mobile primary">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "mobile-tabbar__item active" : "mobile-tabbar__item")}>
        <HomeIcon />
        <span>Home</span>
      </NavLink>
      <NavLink to="/meals" className={({ isActive }) => (isActive ? "mobile-tabbar__item active" : "mobile-tabbar__item")}>
        <MealsIcon />
        <span>Meals</span>
      </NavLink>
      <NavLink to="/exercises" className={({ isActive }) => (isActive ? "mobile-tabbar__item active" : "mobile-tabbar__item")}>
        <ExerciseIcon />
        <span>Exercise</span>
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => (isActive ? "mobile-tabbar__item active" : "mobile-tabbar__item")}>
        <ProgressIcon />
        <span>Progress</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => (isActive ? "mobile-tabbar__item active" : "mobile-tabbar__item")}>
        <ProfileIcon />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 10v9h11v-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MealsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 12a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.5v7M8.5 12H15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ExerciseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9h2l2 2 6-6 2 2-6 6 2 2v2h-2l-2-2-2 2H5v-2l2-2-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 16v-4M12 16V8M16.5 16v-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 18c1.4-2.6 3.4-3.9 5.5-3.9S16.1 15.4 17.5 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
