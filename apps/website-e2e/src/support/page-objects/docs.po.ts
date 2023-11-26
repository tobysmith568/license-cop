import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class DocsPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /documentation/i, level: 1 }).should("exist");

  containsTheSetupHeading = () =>
    cy.findByRole("heading", { name: /setup/i, level: 2 }).should("exist");

  containsTheConfigFileHeading = () =>
    cy.findByRole("heading", { name: /config file/i, level: 2 }).should("exist");

  containsTheGitHubCiCdHeading = () =>
    cy
      .findByRole("heading", { name: /ci\/cd example \(github actions\)/i, level: 2 })
      .should("exist");

  footer = () => new FooterComponent();
}
