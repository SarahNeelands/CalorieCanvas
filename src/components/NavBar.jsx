import React, { useEffect, useRef, useState, forwardRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "./NavBar.css";
import underlineImg from "../images/VineUnderline.png";
import logoSrc from "../images/IconBackground.png";

export default function NavBar() {
  const navRef  = useRef(null);
  const vineRef = useRef(null);
  const { pathname } = useLocation();

  const [box, setBox] = useState({ left: 0, width: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const lastBox = useRef(box);
  const raf = useRef(0);

  const setIfChanged = (next) => {
    const prev = lastBox.current;
    const near = (a, b) => Math.abs(a - b) < 0.5;
    if (near(prev.left, next.left) && near(prev.top, next.top) && near(prev.width, next.width)) return;
    lastBox.current = next;
    setBox(next);
  };

  const measure = () => {
    const navEl = navRef.current;
    const vineEl = vineRef.current;
    if (!navEl || !vineEl) return;

    const active = navEl.querySelector("a.active");
    if (!active) { if (visible) setVisible(false); return; }

    const navRect = navEl.getBoundingClientRect();
    const aRect   = active.getBoundingClientRect();

    // ✅ read the current vine height from CSS each time
    const computed = getComputedStyle(vineEl);
    const vineH = parseFloat(computed.height) || 24;

    const gap = -2; // small upward nudge

    const next = {
      left: aRect.left - navRect.left + navEl.scrollLeft,
      width: aRect.width,
      top: (aRect.bottom - navRect.top) - vineH + gap,
    };

    setVisible(true);
    setIfChanged(next);
  };


  useEffect(() => { measure(); }, [pathname]);

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

  useEffect(() => { document.fonts?.ready?.then(measure); }, []);

  return (
    <header className="header" role="banner">
      <div className="brand">
        <img src={logoSrc} alt="Calorie Canvas" className="logo" />
        <span className="brand-text">Calorie Canvas</span>
      </div>

      <nav className="nav" aria-label="Primary" ref={navRef}>
        <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/meals" className={({isActive}) => isActive ? "active" : ""}>Meals</NavLink>
        <NavLink to="/exercises" className={({isActive}) => isActive ? "active" : ""}>Exercises</NavLink>
        <NavLink to="/progress" className={({isActive}) => isActive ? "active" : ""}>Progress</NavLink>

        <ImageUnderline
          ref={vineRef}
          src={underlineImg}
          left={box.left}
          width={box.width}
          top={box.top}
          visible={visible}
          key={pathname}
        />
      </nav>

      {/* RIGHT SIDE: only the bell */}
      <div className="right">
        <button className="bell" aria-label="Notifications">🔔</button>
      </div>
    </header>
  );
}

const ImageUnderline = forwardRef(function ImageUnderline(
  { src, left, width, top, visible },
  ref
){
  return (
    <div
      ref={ref}
      className="vine-photo-underline"
      style={{
        left,
        top,
        width,
        opacity: visible ? 1 : 0,
        ["--vine-img"]: `url(${src})`,
      }}
      aria-hidden="true"
    />
  );
});
