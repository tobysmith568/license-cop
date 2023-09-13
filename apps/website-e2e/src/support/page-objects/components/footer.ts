export class FooterComponent {
  constructor() {
    this.footer().should("exist");
  }

  containsAnIndexLink = () =>
    this.footer().within(() =>
      cy.findByRole("link", { name: "Home" }).should("exist").and("have.attr", "href", "/")
    );

  containsADocsLink = () =>
    this.footer().within(() =>
      cy.findByRole("link", { name: "Docs" }).should("exist").and("have.attr", "href", "/docs")
    );

  containsAPermissiveLink = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "@license-cop/permissive" })
        .should("exist")
        .and("have.attr", "href", "/permissive")
    );

  containsAShieldLink = () =>
    this.footer().within(() =>
      cy.findByRole("link", { name: "Shield" }).should("exist").and("have.attr", "href", "/shield")
    );

  containsALinkToGitHub = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "GitHub" })
        .should("exist")
        .and("have.attr", "href", "https://github.com/tobysmith568/license-cop")
        .and("have.attr", "target", "_blank")
    );

  containsALinkToNpm = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "npm" })
        .should("exist")
        .and("have.attr", "href", "https://npmjs.com/package/license-cop")
        .and("have.attr", "target", "_blank")
    );

  containsALinkToTheTermsAndConditions = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "Terms & Conditions" })
        .should("exist")
        .and("have.attr", "href", "/terms")
    );

  containsALinkToThePrivacyPolicy = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "Privacy Policy" })
        .should("exist")
        .and("have.attr", "href", "/privacy")
    );

  containsALinkToTheCookiesPolicy = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "Cookies" })
        .should("exist")
        .and("have.attr", "href", "/cookies")
    );

  containsALinkToTheThirdPartyContentNotices = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "Third-party Content" })
        .should("exist")
        .and("have.attr", "href", "/third-party")
    );

  containsALinkToTobySmithDotUk = () =>
    this.footer().within(() =>
      cy
        .findByRole("link", { name: "Toby Smith" })
        .should("exist")
        .and("have.attr", "href", "https://tobysmith.uk")
        .and("have.attr", "target", "_blank")
    );

  private footer = () => cy.findByRole("contentinfo");
}
