import React from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({ onDetected, onError, facingMode = "environment" }) {
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
            if (result) onDetected?.(result.getText());
          });
        }
      } catch (e) { onError?.(e); }
    }
    start();
    return () => {
      reader.reset();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [facingMode, onDetected, onError]);
  return <video ref={videoRef} style={{ width: "100%", borderRadius: 12 }} />;
}
