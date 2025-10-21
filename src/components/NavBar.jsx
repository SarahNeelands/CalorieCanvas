import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "./NavBar.css";
import underlineImg from "../images/VineUnderline.png"; // ✅ correct way
import logoSrc from "../images/IconBackground.png"

export default function NavBar({ profileImageSrc }) {

  const navRef = useRef(null);
  const { pathname } = useLocation();

  const [box, setBox] = useState({ left: 0, width: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const lastBox = useRef(box);
  const raf = useRef(0);

  const setIfChanged = (next) => {
    const prev = lastBox.current;
    const near = (a, b) => Math.abs(a - b) < 0.5;
    if (near(prev.left, next.left) && near(prev.top, next.top) && near(prev.width, next.width)) {
      return; // do not setState -> avoids loops
    }
    lastBox.current = next;
    setBox(next);
  };

  const measure = () => {
    const navEl = navRef.current;
    if (!navEl) return;

    const active = navEl.querySelector("a.active");
    if (!active) { if (visible) setVisible(false); return; }

    const navRect = navEl.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();

    const next = {
      left: aRect.left - navRect.left + navEl.scrollLeft,
      width: aRect.width,
      top: aRect.bottom - navRect.top + 8,
    };

    setVisible(true);
    setIfChanged(next);
  };

  // measure on route change (and once on mount)
  useEffect(() => { measure(); }, [pathname]);

  // measure on window resize only (no ResizeObserver -> no feedback loop)
  useEffect(() => {
    const onResize = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // if fonts shift width after load
  useEffect(() => { document.fonts?.ready?.then(measure); }, []);

  return (
    <header className="header" role="banner">
      <div className="brand">
        <img src={logoSrc} alt="Calorie Canvas" className="logo" />
        <h>Calorie Canvas</h>
      </div>
      

      <nav className="nav" aria-label="Primary" ref={navRef}>
        <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/meals" className={({isActive}) => isActive ? "active" : ""}>Meals</NavLink>
        <NavLink to="/exercises" className={({isActive}) => isActive ? "active" : ""}>Exercises</NavLink>
        <NavLink to="/progress" className={({isActive}) => isActive ? "active" : ""}>Progress</NavLink>

        <ImageUnderline
          src={underlineImg}
          left={box.left}
          width={box.width}
          top={box.top}
          visible={visible}
          // remount only when route changes -> retriggers the fade
          key={pathname}
        />
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

function ImageUnderline({ src, left, width, top, visible }) {
  return (
    <div
      className="vine-photo-underline"
      style={{
        left,
        top,
        width,
        opacity: visible ? 1 : 0,
        ['--vine-img']: `url(${src})`,
      }}
      aria-hidden="true"
    />
  );
}
