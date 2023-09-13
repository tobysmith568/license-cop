import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class IndexPageObject {
  header = () => new HeaderComponent();
  hero = () => new IndexHeroComponent();
  footer = () => new FooterComponent();
}

class IndexHeroComponent {
  containsTheTitle = () =>
    cy.findAllByRole("heading", { name: "License-Cop", level: 1 }).should("exist");
}
