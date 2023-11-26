import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class PrivacyPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /privacy policy/i, level: 1 }).should("exist");

  containsTheContactUsHeading = () =>
    cy.findByRole("heading", { name: /contact us/i, level: 2 }).should("exist");

  footer = () => new FooterComponent();
}
