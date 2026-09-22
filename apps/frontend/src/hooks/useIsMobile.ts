import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 900px), (pointer: coarse)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px), (pointer: coarse)");
    const listener = () => setMobile(query.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return mobile;
}
