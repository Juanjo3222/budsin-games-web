import { useEffect, useRef } from "react";
import { usePro } from "../context/ProContext";

const AD_SCRIPT_SRC = "https://pl29226955.profitablecpmratenetwork.com/3822757dc469f188bf377ea7050634be/invoke.js";
const AD_CONTAINER_ID = "container-3822757dc469f188bf377ea7050634be";

export default function AdsSlot() {
  const { isPro } = usePro();
  const injected = useRef(false);

  useEffect(() => {
    if (isPro) return;
    if (injected.current) return;
    injected.current = true;
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = AD_SCRIPT_SRC;
    document.body.appendChild(script);
  }, [isPro]);

  if (isPro) return null;

  return <div id={AD_CONTAINER_ID} className="ads-slot" aria-hidden="true" />;
}
