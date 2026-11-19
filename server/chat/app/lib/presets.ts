// Stickers predefinidos (no se sube nada): el servidor solo guarda el id, la página los dibuja como emoji grande.
export const PRESET_PACKS: { id: string; name: { es: string; en: string; pt: string }; items: string[] }[] = [
  { id: "react", name: { es: "Reacciones", en: "Reactions", pt: "Reações" }, items: ["laugh", "cry", "love", "cool", "think", "wow", "angry", "sleep", "party", "clap", "thumbs", "ok"] },
  { id: "game", name: { es: "Gaming", en: "Gaming", pt: "Gaming" }, items: ["controller", "trophy", "gg", "fire", "rocket", "ghost", "crown", "bomb", "sword", "heart", "star", "skull"] },
  { id: "animal", name: { es: "Animales", en: "Animals", pt: "Animais" }, items: ["cat", "dog", "fox", "panda", "frog", "lion", "unicorn", "penguin", "octopus", "dino", "monkey", "bear"] },
  { id: "food", name: { es: "Comida", en: "Food", pt: "Comida" }, items: ["pizza", "burger", "fries", "icecream", "donut", "cake", "watermelon", "taco", "popcorn", "cookie", "candy", "soda"] },
];
export const PRESET_IDS = new Set(PRESET_PACKS.flatMap((p) => p.items));
