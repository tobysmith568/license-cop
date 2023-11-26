import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class IndexPageObject {
  header = () => new HeaderComponent();
  hero = () => new IndexHeroComponent();

  containsTheWhyCheckLicensesHeading = () =>
    cy.findByRole("heading", { name: /why check your licenses\?/i, level: 2 }).should("exist");

  containsTheWhyLicenseCopHeading = () =>
    cy.findByRole("heading", { name: /why license-cop\?/i, level: 2 }).should("exist");

  containsTheHowToGetStartedHeading = () =>
    cy.findByRole("heading", { name: /how to get started/i, level: 2 }).should("exist");

  footer = () => new FooterComponent();
}

class IndexHeroComponent {
  containsTheTitle = () =>
    cy.findAllByRole("heading", { name: "License-Cop", level: 1 }).should("exist");

  containsTheInstallCommand = () =>
    cy.findByText(/npm install license-cop --save-dev/i).should("exist");
}
