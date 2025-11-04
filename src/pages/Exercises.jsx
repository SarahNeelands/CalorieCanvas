// src/pages/Exercises.jsx
import React, { useState } from "react";

// Context
import { ExerciseProvider } from '../components/exercise/context/ExerciseContext.jsx';

// Page bits
import ExercisePageHeader from '../components/exercise/ExercisePageHeader.jsx';
import DayLogsModal from '../components/exercise/DayLogsModal.jsx';
import LogExerciseModal from '../components/exercise/LogExerciseModal.jsx';

// Charts
import DailyMinutesChart from '../components/exercise/charts/DailyMinutesChart.jsx';
import TypeBreakdownPie from '../components/exercise/charts/TypeBreakdownPie.jsx';

// UI
import Card from '../components/ui/Card.jsx';
import NavBar from "../components/NavBar";

import "./Exercises.css";

export default function Exercises({ user }) {
  return (
    <div className="ex-page">
      <NavBar profileImageSrc={user?.avatar}/>
      <ExerciseProvider>
        <ExercisePageInner />
      </ExerciseProvider>
    </div>
  );
}

function ExercisePageInner() {
  const [range, setRange] = useState("7");
  const [selectedDate, setSelectedDate] = useState(null);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="ex-container">
      <ExercisePageHeader
        range={range}
        onChangeRange={setRange}
        onLog={() => setLogOpen(true)}
      />

      <div className="ex-grid">
        <Card title={`Minutes per day (last ${range} days)`}>
          <DailyMinutesChart range={range} onSelectDate={(d) => setSelectedDate(d)} />
          <p className="ex-hint">Click a bar to view that day’s logs.</p>
        </Card>

        <Card title={`By type (last ${range} days)`}>
          <TypeBreakdownPie range={range} />
        </Card>
      </div>

      {selectedDate && (
        <DayLogsModal
          dateStr={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {logOpen && <LogExerciseModal onClose={() => setLogOpen(false)} />}
    </div>
  );
}
