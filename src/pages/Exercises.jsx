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

// UI (note the capital U in Ui)
import Card from '../components/ui/Card.jsx';


export default function Exercises() {
return (
<ExerciseProvider>
<ExercisePageInner />
</ExerciseProvider>
);
}


function ExercisePageInner() {
const [range, setRange] = useState("7");
const [selectedDate, setSelectedDate] = useState(null);
const [logOpen, setLogOpen] = useState(false);


return (
<div className="p-6 max-w-6xl mx-auto">
<ExercisePageHeader range={range} onChangeRange={setRange} onLog={() => setLogOpen(true)} />


<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
<Card title={`Minutes per day (last ${range} days)`}>
<DailyMinutesChart range={range} onSelectDate={(d) => setSelectedDate(d)} />
<p className="text-sm text-gray-500 mt-2">Click a bar to view that day’s logs.</p>
</Card>


<Card title={`By type (last ${range} days)`}>
<TypeBreakdownPie range={range} />
</Card>
</div>


{selectedDate && (
<DayLogsModal dateStr={selectedDate} onClose={() => setSelectedDate(null)} />
)}


{logOpen && <LogExerciseModal onClose={() => setLogOpen(false)} />}
</div>
);
}
