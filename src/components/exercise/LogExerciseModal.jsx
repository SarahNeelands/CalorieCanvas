import React, { useState } from "react";
import Modal from '../ui/Modal.jsx'
import ExerciseLogForm from './ExerciseLogForm.jsx'
import NewExerciseTypeForm from './NewExerciseTypeForm.jsx'
import { useExercise } from './context/ExerciseContext.jsx'
import "./LogExerciseModal.css";

export default function LogExerciseModal({ onClose }) {
const { state, addLog, addExerciseType } = useExercise();
const [showNewType, setShowNewType] = useState(false);
const [pendingName, setPendingName] = useState("");


return (
<Modal title="Log exercise" onClose={onClose}>
<div className="log-exercise-modal">
<ExerciseLogForm
types={state.exerciseTypes}
onAddNewType={(name) => { setPendingName(name); setShowNewType(true); }}
onSubmit={(payload) => { addLog(payload); onClose(); }}
/>


{showNewType && (
<div className="log-exercise-modal__new-type">
<NewExerciseTypeForm
initialName={pendingName}
onCancel={() => setShowNewType(false)}
onCreate={(name) => { addExerciseType(name); setShowNewType(false); }}
/>
</div>
)}
</div>
</Modal>
);
}
