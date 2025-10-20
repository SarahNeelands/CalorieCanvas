import React from "react";
import { NavLink, Link } from "react-router-dom";
import "./NavBar.css";

export default function NavBar({ profileImageSrc }) {
  const logoSrc = "/cc/logo-mark.png";
  return (
    <header className="header" role="banner">
      <div className="brand">
        <img src={logoSrc} alt="Calorie Canvas" width={36} height={36} />
        <h1>Calorie Canvas</h1>
      </div>

      <nav className="nav" aria-label="Primary">
        <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/meals" className={({isActive}) => isActive ? "active" : ""}>Meals</NavLink>
        <NavLink to="/exercises" className={({isActive}) => isActive ? "active" : ""}>Exercises</NavLink>
        <NavLink to="/progress" className={({isActive}) => isActive ? "active" : ""}>Progress</NavLink>
      </nav>

      <div className="right">
        <button className="btn btn-soft bell" aria-label="Notifications">🔔</button>
        <Link to="/profile" aria-label="Profile">
          <div className="avatar" style={{ backgroundImage: `url(${profileImageSrc})` }} />
        </Link>
      </div>
    </header>
  );
}
