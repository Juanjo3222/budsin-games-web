import { useEffect } from "react";

// Los Términos y la Privacidad viven en budsin.dev: las rutas antiguas del portal llevan allí.
export default function ExternalRedirect({ to }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return (
    <main style={{ padding: "48px 16px", textAlign: "center" }}>
      <a href={to} className="text-link">{to}</a>
    </main>
  );
}
