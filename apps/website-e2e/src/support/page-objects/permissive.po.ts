import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class PermissivePageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /@license-cop\/permissive/i, level: 1 }).should("exist");

  containsTheNpmUsageHeading = () =>
    cy.findByRole("heading", { name: /usage \(npm\)/i, level: 2 }).should("exist");

  containsTheUrlUsageHeading = () =>
    cy.findByRole("heading", { name: /usage \(url\)/i, level: 2 }).should("exist");

  containsTheLicenseConstraintsHeading = () =>
    cy.findByRole("heading", { name: /license constraints/i, level: 2 }).should("exist");

  containsTheLicenseListHeading = () =>
    cy.findByRole("heading", { name: /license list/i, level: 2 }).should("exist");

  containsThePermissiveConfigContent = () => {
    cy.findByText(/\/\/ mit-like/i).should("exist");
    cy.findByText(/\/\/ apache/i).should("exist");
    cy.findByText(/\/\/ bsd/i).should("exist");
    cy.findByText(/\/\/ creative commons/i).should("exist");
    cy.findByText(/\/\/ microsoft/i).should("exist");
    cy.findByText(/\/\/ other/i).should("exist");
  };

  footer = () => new FooterComponent();
}
