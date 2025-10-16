import React, { useState } from "react";
import Modal from '../ui/Modal.jsx'
import ExerciseLogForm from './ExerciseLogForm.jsx'
import NewExerciseTypeForm from './NewExerciseTypeForm.jsx'
import { useExercise } from './context/ExerciseContext.jsx'

export default function LogExerciseModal({ onClose }) {
const { state, addLog, addExerciseType } = useExercise();
const [showNewType, setShowNewType] = useState(false);
const [pendingName, setPendingName] = useState("");


return (
<Modal title="Log exercise" onClose={onClose}>
<ExerciseLogForm
types={state.exerciseTypes}
onAddNewType={(name) => { setPendingName(name); setShowNewType(true); }}
onSubmit={(payload) => { addLog(payload); onClose(); }}
/>


{showNewType && (
<div className="mt-4 border-t pt-4">
<NewExerciseTypeForm
initialName={pendingName}
onCancel={() => setShowNewType(false)}
onCreate={(name) => { const t = addExerciseType(name); setShowNewType(false); }}
/>
</div>
)}
</Modal>
);
}