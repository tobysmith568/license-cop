import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class ThirdPartyPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /third-party content/i, level: 1 }).should("exist");

  containsTheSourcesHeading = () =>
    cy.findByRole("heading", { name: /sources/i, level: 2 }).should("exist");

  containsTheLicensesHeading = () =>
    cy.findByRole("heading", { name: /licenses/i, level: 2 }).should("exist");

  containsTheGenerateLicenseFileContent = () =>
    cy
      .findAllByText(/the following npm packages may be included in this project:/i)
      .should("have.length.greaterThan", 0);

  footer = () => new FooterComponent();
}
