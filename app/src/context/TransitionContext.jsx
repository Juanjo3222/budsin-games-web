import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { playOpen } from "../lib/sfx";

const TransitionContext = createContext(null);

const COVER_MS = 450; // el círculo termina de cubrir la pantalla
const OUT_DELAY_MS = 160; // margen para que la nueva ruta se pinte antes de destapar
const OUT_MS = 320; // duración del desvanecimiento
const SAFETY_MS = 6000; // por si la navegación nunca llega a ocurrir

/**
 * Transición tipo consola: suena un efecto y un círculo se expande desde el
 * elemento pulsado hasta cubrir la pantalla. Con `settle: "route"` se destapa
 * al llegar a la nueva ruta; con `settle: "page"` (navegación completa) queda
 * cubierta hasta que el navegador cambie de página.
 */
export function TransitionProvider({ children }) {
  const [state, setState] = useState(null);
  const timers = useRef([]);
  const busy = useRef(false);

  const later = useCallback((fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    busy.current = false;
    setState(null);
  }, []);

  const run = useCallback(
    (origin, action, { settle = "route" } = {}) => {
      if (busy.current) return;
      busy.current = true;
      playOpen();
      const rect = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : null;
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      setState({ x, y, phase: "in" });
      later(() => {
        action();
        if (settle === "route") {
          later(() => setState((s) => (s ? { ...s, phase: "out" } : s)), OUT_DELAY_MS);
          later(finish, OUT_DELAY_MS + OUT_MS);
        }
      }, COVER_MS);
      later(finish, SAFETY_MS);
    },
    [later, finish]
  );

  // Al volver con "Atrás" el navegador puede restaurar la página con la transición aún puesta.
  useEffect(() => {
    const onShow = (e) => {
      if (e.persisted) finish();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      timers.current.forEach(clearTimeout);
    };
  }, [finish]);

  const value = useMemo(() => ({ run }), [run]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
      {state && (
        <div className={`transition-overlay is-${state.phase}`} style={{ "--tx": `${state.x}px`, "--ty": `${state.y}px` }} aria-hidden="true">
          <span className="transition-ring" />
          <span className="transition-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
    </TransitionContext.Provider>
  );
}

const NO_TRANSITION = { run: (origin, action) => action() };

/** Sin proveedor (p. ej. en el prerender) la acción se ejecuta directamente. */
export function usePageTransition() {
  return useContext(TransitionContext) || NO_TRANSITION;
}
