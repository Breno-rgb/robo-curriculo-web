/** Tira acentos e deixa minúsculo: "Técnico" → "tecnico". Assim "Júnior" e "junior" viram a mesma coisa. */
export const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
