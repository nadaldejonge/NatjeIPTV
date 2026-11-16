import { useEffect, useState } from "react";
import BrandImage from "./BrandImage";

const messages = ["Laden…", "Heb je al gedraaid…?", "Inladen van categorieën en zenders…"];

export default function StartupScreen({ stage }: { stage: string }) {
  const [message, setMessage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setMessage((current) => (current + 1) % messages.length), 2000);
    return () => window.clearInterval(timer);
  }, []);
  return <main className="tv-startup" aria-label="Applicatie laden">
    <div className="tv-startup-brand"><BrandImage variant="wordmark" /></div>
    <div className="tv-startup-content" role="status" aria-live="polite">
      <span className="tv-startup-spinner" aria-hidden="true" />
      <p>{messages[message]}</p><span>{stage}</span>
    </div>
  </main>;
}
