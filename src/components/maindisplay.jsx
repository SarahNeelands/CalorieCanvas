import React from "react";
import "../styles/calorie-canvas.css";

export default function CalorieCanvas() {
  const goal = 2000;
  const eaten = 1200;
  const left = goal - eaten;
  const pct  = Math.max(0, Math.min(100, (eaten / goal) * 100));

  const meals = [
    { id: 1, title: "Oatmeal with Berries",            time: "10:30 AM", kcal: 350 },
    { id: 2, title: "Grilled Chicken Salad",           time: "1:15 PM",  kcal: 450 },
    { id: 3, title: "Salmon with Roasted Vegetables",  time: "7:00 PM",  kcal: 600 },
  ];

  const avatar = "/cc/avatar.png"; // or your URL

  return (
    <div className="cc-app">
      {/* Decorative leaves (identical placement) */}
      <div className="cc-wrap">
        {/* Header */}
        <header className="cc-header">
          <div className="cc-brand">
            <img src="/cc/logo-mark.png" width={40} height={40} alt="Calorie Canvas" />
            <h1>Calorie Canvas</h1>
          </div>

          <nav className="cc-nav">
            <a className="active" href="#dashboard">Dashboard</a>
            <a href="#meals">Meals</a>
            <a href="#exercises">Exercises</a>
            <a href="#progress">Progress</a>
          </nav>

          <div className="cc-right">
            <button className="cc-btn cc-btn-soft" style={{ width: 44, height: 44 }}>🔔</button>
            <div className="cc-avatar" style={{ backgroundImage: `url(${avatar})` }} />
          </div>
        </header>

        {/* Grid */}
        <div className="cc-grid">
          {/* Left side: summary + list */}
          <section>
            <div className="cc-card" style={{ padding: 24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <h2 className="cc-h2">Today’s Canvas</h2>
                  <p className="cc-sub">Your daily calorie summary.</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize: "44px", lineHeight: 1, fontWeight: 900 }}>{left}</div>
                  <div className="cc-sub">kcal left</div>
                </div>
              </div>

              <div className="cc-space-24">
                <div className="cc-progress">
                  <div className="track" />
                  <div className="fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="cc-mutedrow">
                  <span>Goal: {goal} kcal</span>
                  <span>{eaten} kcal eaten</span>
                </div>
              </div>
            </div>

            <div className="cc-space-24">
              <h3 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>Recent Meals</h3>
              <div className="cc-list">
                {meals.map(m => (
                  <div key={m.id} className="cc-item">
                    <div>
                      <div style={{ fontWeight: 800 }}>{m.title}</div>
                      <div className="cc-sub" style={{ fontSize: 14 }}>{m.time}</div>
                    </div>
                    <div className="cc-kcal">
                      {m.kcal} <span style={{ fontWeight: 600 }}>kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right side: Quick Actions inside painted frame */}
          <aside>
            <div className="cc-frame">
              <h3 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>Quick Actions</h3>
              <div style={{ display:"grid", gap: 14 }}>
                <button className="cc-btn cc-btn-solid">Log Meal</button>
                <button className="cc-btn cc-btn-soft">Log Exercise</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
