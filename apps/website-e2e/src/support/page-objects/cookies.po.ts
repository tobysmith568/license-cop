import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class CookiesPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /cookies policy/i, level: 1 }).should("exist");

  containsTheContactUsHeading = () =>
    cy.findByRole("heading", { name: /contact us/i, level: 2 }).should("exist");

  footer = () => new FooterComponent();
}
