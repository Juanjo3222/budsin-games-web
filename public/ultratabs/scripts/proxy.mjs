import { registerSW } from "/proxy/register-sw.mjs";
import * as BareMux from "/proxy/baremux/index.mjs";

const connection = new BareMux.BareMuxConnection("/proxy/baremux/worker.js")

export function search(input, template) {
    try {
        return new URL(input).toString();
    } catch (err) { }

    try {
        const url = new URL(`http://${input}`);
        if (url.hostname.includes(".")) return url.toString();
    } catch (err) { }

    return template.replace("%s", encodeURIComponent(input));
}

export async function getUV(input) {
    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    let url = search(input, 'https://www.google.com/search?q=%s');

    // IMPORTANT: Change this to your Wisp server URL or else the site will not function
    // let wispUrl = "wss://your.wisp.server/wisp/"
    // if (await connection.getTransport() !== "/proxy/epoxy/index.mjs") {
    //     await connection.setTransport("/proxy/epoxy/index.mjs", [{ wisp: wispUrl }]);
    // }
    if (await connection.getTransport() !== "/proxy/libcurl/libcurl.mjs") {
        await connection.setTransport("/proxy/libcurl/libcurl.mjs", [{ wisp: wispUrl }]);
    }

    let viewUrl = __uv$config.prefix + __uv$config.encodeUrl(url);

    return viewUrl;
}