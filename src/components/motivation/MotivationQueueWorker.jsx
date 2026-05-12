import React from "react";
import { flushQueuedMotivationEvents, getQueuedMotivationEventCount } from "../../services/motivationClient";

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

export default function MotivationQueueWorker() {
  const flushQueue = React.useCallback(async () => {
    if (!navigator.onLine) return;
    if (getQueuedMotivationEventCount() === 0) return;

    try {
      await flushQueuedMotivationEvents();
    } catch {}
  }, []);

  React.useEffect(() => {
    flushQueue();

    const intervalId = window.setInterval(() => {
      void flushQueue();
    }, FLUSH_INTERVAL_MS);

    const handleOnline = () => {
      void flushQueue();
    };
    const handleFocus = () => {
      void flushQueue();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        void flushQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushQueue]);

  return null;
}
