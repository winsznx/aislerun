export interface FixtureDefinition {
  version: string;
  disclosure: string;
  drawerLookup: string;
}

const sharedDrawer = `    return document.getElementById("CartDrawer");`;

// The seeded defect: below 750px the drawer lookup targets an element that does not exist,
// so the submit handler throws before the cart is written. fixture-fixed-v2 is the one-line repair.
const mobileBrokenDrawer = `    var isMobile = window.matchMedia("(max-width: 749px)").matches;
    return document.getElementById(isMobile ? "CartDrawer-mobile" : "CartDrawer");`;

export const FIXTURES: FixtureDefinition[] = [
  { version: "fixture-healthy-v1", disclosure: "Healthy control: no seeded defect.", drawerLookup: sharedDrawer },
  {
    version: "fixture-mobile-cart-broken-v1",
    disclosure: "Seeded defect: Add to cart fails below 750px wide.",
    drawerLookup: mobileBrokenDrawer,
  },
  { version: "fixture-fixed-v2", disclosure: "Repair of the seeded mobile Add to cart defect.", drawerLookup: sharedDrawer },
];
