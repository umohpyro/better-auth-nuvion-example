// Categorical colours from the Nuvion palette (the accent is picked separately): one hue per organization.
export const PALETTE = [
  "#E8590C",
  "#2F6FE0",
  "#2E9E4F",
  "#A8531C",
  "#F63080",
  "#0E8F83",
];
export const colorFor = (id: string) =>
  PALETTE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
export const money = (minor: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / 100,
  );
