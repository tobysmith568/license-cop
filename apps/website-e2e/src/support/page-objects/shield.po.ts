import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class ShieldPageObject {
  header = () => new HeaderComponent();

  containsTheMainHeading = () =>
    cy.findByRole("heading", { name: /license-cop shield/i, level: 1 }).should("exist");

  containsTheBadge = () =>
    cy
      .findByRole("img", { name: /protected by: license-cop/i })
      .should("exist")
      .should("be.visible")
      .and(($img: JQuery<HTMLImageElement>) => {
        expect($img).to.have.length(1);

        expect($img[0].naturalWidth).to.be.greaterThan(0);
        expect($img[0].naturalHeight).to.be.greaterThan(0);
      });

  containsTheHtmlHeader = () =>
    cy.findByRole("heading", { name: /html/i, level: 2 }).should("exist");

  containsTheMarkdownHeader = () =>
    cy.findByRole("heading", { name: /markdown/i, level: 2 }).should("exist");

  footer = () => new FooterComponent();
}
