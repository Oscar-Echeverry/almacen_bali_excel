import { useEffect, useState } from "react";

export function RestrictedToast(): JSX.Element | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setMessage(custom.detail);
      window.setTimeout(() => setMessage(null), 2600);
    };
    window.addEventListener("restricted-action", listener);
    return () => window.removeEventListener("restricted-action", listener);
  }, []);
  return message ? <div className="toast" role="status">{message}</div> : null;
}
