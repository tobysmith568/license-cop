export class HeaderComponent {
  constructor() {
    this.navigation().should("exist");
  }

  containsAnIndexLink = () =>
    this.navigation().within(() =>
      cy.findByRole("link", { name: "Home" }).should("exist").and("have.attr", "href", "/")
    );

  containsADocsLink = () =>
    this.navigation().within(() =>
      cy.findByRole("link", { name: "Docs" }).should("exist").and("have.attr", "href", "/docs")
    );

  containsAPermissiveLink = () =>
    this.navigation().within(() =>
      cy
        .findByRole("link", { name: "@license-cop/permissive" })
        .should("exist")
        .and("have.attr", "href", "/permissive")
    );

  containsAShieldLink = () =>
    this.navigation().within(() =>
      cy.findByRole("link", { name: "Shield" }).should("exist").and("have.attr", "href", "/shield")
    );

  containsALinkToGitHub = () =>
    this.navigation().within(() =>
      cy
        .findByRole("link", { name: "GitHub" })
        .should("exist")
        .and("have.attr", "href", "https://github.com/tobysmith568/license-cop")
        .and("have.attr", "target", "_blank")
    );

  containsALinkToNpm = () =>
    this.navigation().within(() =>
      cy
        .findByRole("link", { name: "npm" })
        .should("exist")
        .and("have.attr", "href", "https://npmjs.com/package/license-cop")
        .and("have.attr", "target", "_blank")
    );

  private navigation = () => cy.findByRole("navigation");
}
