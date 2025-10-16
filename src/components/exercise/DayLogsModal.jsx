import React from "react";
import Modal from '../ui/Modal.jsx'
import DayLogList from "./DayLogList.jsx";
import { useExercise } from "./context/ExerciseContext.jsx";


export default function DayLogsModal({ dateStr, onClose }) {
const { logsForDate, typesById } = useExercise();
return (
<Modal title={`Logs for ${dateStr}`} onClose={onClose}>
<DayLogList logs={logsForDate(dateStr)} typesById={typesById} />
</Modal>
);
}