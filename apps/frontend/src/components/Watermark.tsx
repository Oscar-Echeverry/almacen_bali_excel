import { type CSSProperties, useEffect, useState } from "react";

interface WatermarkProps {
  userName: string;
  deviceName: string;
  sessionPublicId: string;
}

export function Watermark({ userName, deviceName, sessionPublicId }: WatermarkProps): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const label = `CONFIDENCIAL | ${userName} | ${deviceName} | ${sessionPublicId} | ${now.toLocaleString()}`;
  return <div className="watermark" aria-hidden="true" style={{ "--watermark-text": `"${label}"` } as CSSProperties} />;
}
