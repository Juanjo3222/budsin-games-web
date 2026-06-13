self.__scramjet$config = {
  prefix: "/scramjet/",
  bare: "https://bare.budsin.dev/bare/", // <-- ADD YOUR CLOUDFLARE TUNNEL HERE
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all:  "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
};
