// Envoltorio ES del transporte epoxy. BareMux hace `import(ruta)` desde su worker y espera un `default` con la clase,
// pero index.js es un bundle UMD: al importarlo como módulo solo deja la clase en globalThis.EpoxyTransport.
import "./index.js";
const T = globalThis.EpoxyTransport;
export default T && T.default ? T.default : T;
