// Envoltorio ES del transporte epoxy para BareMux 2.1.9 (baremux/worker.js).
//  1) BareMux hace `import(ruta)` y espera un `default` con la clase, pero index.js es un bundle UMD: al importarlo como
//     módulo solo deja la clase en globalThis.EpoxyTransport.
//  2) BareMux 2.1.9 pasa las cabeceras como objeto {nombre: valor} y espera la respuesta igual; este epoxy trabaja con
//     listas [[nombre, valor], …]. Se convierte en los dos sentidos.
import "./index.js";
const Base = globalThis.EpoxyTransport && globalThis.EpoxyTransport.default ? globalThis.EpoxyTransport.default : globalThis.EpoxyTransport;

const toPairs = (h) => (!h ? [] : typeof h[Symbol.iterator] === "function" ? h : Object.entries(h));
const toRecord = (pairs) => {
  const rec = {};
  for (const [k, v] of pairs) {
    if (k in rec) rec[k] = Array.isArray(rec[k]) ? [...rec[k], v] : [rec[k], v];
    else rec[k] = v;
  }
  return rec;
};

export default class EpoxyBareTransport extends Base {
  async request(remote, method, body, headers, signal) {
    const res = await super.request(remote, method, body, toPairs(headers), signal);
    if (Array.isArray(res.headers)) res.headers = toRecord(res.headers);
    return res;
  }
  connect(url, protocols, requestHeaders, ...rest) {
    return super.connect(url, protocols, toPairs(requestHeaders), ...rest);
  }
}
