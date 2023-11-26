import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class TermsPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy
      .findByRole("heading", { name: /terms and conditions \(“terms”\)/i, level: 1 })
      .should("exist");

  containsTheContactUsHeading = () =>
    cy.findByRole("heading", { name: /contact us/i, level: 2 }).should("exist");

  footer = () => new FooterComponent();
}
