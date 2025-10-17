import React from "react";
import { NavLink, Link } from "react-router-dom";


export default function NavBar({ profileImageSrc }) {
    const logoSrc = "/cc/logo-mark.png";
  return (
    <header className="cc-header cc-container" style={{ position: "relative", zIndex: 1 }}>
      <div className="cc-brand">
        <img src={logoSrc} alt="Calorie Canvas" width={36} height={36} />
        <h1>Calorie Canvas</h1>
      </div>

      <nav className="cc-nav">
        <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/meals" className={({isActive}) => isActive ? "active" : ""}>Meals</NavLink>
        <NavLink to="/exercises" className={({isActive}) => isActive ? "active" : ""}>Exercises</NavLink>
        <NavLink to="/progress" className={({isActive}) => isActive ? "active" : ""}>Progress</NavLink>
      </nav>

      <div className="cc-right">
        <button className="cc-btn cc-btn-soft" style={{ width: 44, height: 44 }} aria-label="Notifications">🔔</button>
        <Link to="/profile" aria-label="Profile">
          <div className="cc-avatar" style={{ backgroundImage: `url(${profileImageSrc})` }} />
        </Link>
      </div>
    </header>
  );
}
