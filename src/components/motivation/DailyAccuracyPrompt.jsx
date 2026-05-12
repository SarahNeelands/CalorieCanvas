import React from "react";
import { useLocation } from "react-router-dom";
import Modal from "../ui/Modal.jsx";
import { getCurrentUserId } from "../../services/authClient";
import { getDailyMealLogSummary } from "../../services/mealLogClient";
import {
  calculateDailyCalorieGoal,
  calculateMaintenanceCalories,
  getProfile,
} from "../../services/profileClient";
import { sendCalorieGoalMetEvent } from "../../services/motivationClient";
import "./DailyAccuracyPrompt.css";

const STORAGE_PREFIX = "cc-daily-accuracy";
const CHECK_INTERVAL_MS = 60 * 1000;
const NOON_HOUR = 12;

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getStorageKey(userId, dateKey) {
  return `${STORAGE_PREFIX}:${userId}:${dateKey}`;
}

function readPromptState(userId, dateKey) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId, dateKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePromptState(userId, dateKey, value) {
  localStorage.setItem(getStorageKey(userId, dateKey), JSON.stringify(value));
}

function isEligibleTime(date = new Date()) {
  return date.getHours() >= NOON_HOUR;
}

function shouldSuppressPrompt(pathname = "") {
  return pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/profile-setup");
}

export default function DailyAccuracyPrompt({ currentUserId }) {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const evaluatePrompt = React.useCallback(async () => {
    const userId = currentUserId || await getCurrentUserId();
    if (!userId) return;
    if (shouldSuppressPrompt(location.pathname)) return;

    const now = new Date();
    if (!isEligibleTime(now)) return;

    const dateKey = getLocalDateKey(now);
    const promptState = readPromptState(userId, dateKey);
    if (promptState?.answeredAt) return;

    setOpen(true);
  }, [currentUserId, location.pathname]);

  React.useEffect(() => {
    evaluatePrompt();

    const intervalId = window.setInterval(evaluatePrompt, CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (!document.hidden) {
        evaluatePrompt();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", evaluatePrompt);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", evaluatePrompt);
    };
  }, [evaluatePrompt]);

  const handleAnswer = React.useCallback(async (wasAccurate) => {
    const userId = currentUserId || await getCurrentUserId();
    if (!userId) {
      setOpen(false);
      return;
    }

    const now = new Date();
    const dateKey = getLocalDateKey(now);
    setSubmitting(true);

    try {
      if (wasAccurate) {
        const [profile, summary] = await Promise.all([
          getProfile(userId),
          getDailyMealLogSummary({ userId, date: now }),
        ]);

        const goalCalories = Number(profile?.calorie_goal) > 0
          ? Number(profile.calorie_goal)
          : calculateDailyCalorieGoal(profile);
        const maintenanceCalories = calculateMaintenanceCalories(profile);
        const consumedCalories = Math.round(Number(summary?.calories || 0));
        const qualifyingThreshold = Math.max(
          Number(goalCalories || 0),
          Number(maintenanceCalories || 0)
        );

        if (qualifyingThreshold > 0 && consumedCalories <= qualifyingThreshold) {
          await sendCalorieGoalMetEvent({
            userId,
            date: dateKey,
            consumedCalories,
            goalCalories,
            maintenanceCalories,
          });
        }
      }

      writePromptState(userId, dateKey, {
        answeredAt: new Date().toISOString(),
        wasAccurate: Boolean(wasAccurate),
      });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [currentUserId]);

  return (
    <Modal open={open} title="Tracking Check" onClose={submitting ? undefined : () => setOpen(false)}>
      <div className="daily-accuracy-prompt">
        <p className="daily-accuracy-prompt__copy">
          Was your calorie tracking accurate today?
        </p>
        <div className="daily-accuracy-prompt__actions">
          <button
            type="button"
            className="daily-accuracy-prompt__button daily-accuracy-prompt__button--secondary"
            onClick={() => void handleAnswer(false)}
            disabled={submitting}
          >
            No
          </button>
          <button
            type="button"
            className="daily-accuracy-prompt__button daily-accuracy-prompt__button--primary"
            onClick={() => void handleAnswer(true)}
            disabled={submitting}
          >
            Yes
          </button>
        </div>
      </div>
    </Modal>
  );
}
