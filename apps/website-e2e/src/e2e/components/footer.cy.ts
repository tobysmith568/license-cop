import { IndexPageObject } from "../../support/page-objects/index.po";

describe("Footer", () => {
  let pageObject: IndexPageObject;

  beforeEach(() => {
    cy.visit("/");
    pageObject = new IndexPageObject();
  });

  describe("first column", () => {
    it("should have a link to the index", () => {
      pageObject.footer().containsAnIndexLink();
    });

    it("should have a link to the docs", () => {
      pageObject.footer().containsADocsLink();
    });

    it("should have a link to the permissive package docs", () => {
      pageObject.footer().containsAPermissiveLink();
    });

    it("should have a link to the shield page", () => {
      pageObject.footer().containsAShieldLink();
    });
  });

  describe("second column", () => {
    it("should have a link to the GitHub repository", () => {
      pageObject.footer().containsALinkToGitHub();
    });

    it("should have a link to the npm page", () => {
      pageObject.footer().containsALinkToNpm();
    });
  });

  describe("third column", () => {
    it("should have a link to the terms and conditions", () => {
      pageObject.footer().containsALinkToTheTermsAndConditions();
    });

    it("should have a link to the privacy policy", () => {
      pageObject.footer().containsALinkToThePrivacyPolicy();
    });

    it("should have a link to the cookies policy", () => {
      pageObject.footer().containsALinkToTheCookiesPolicy();
    });

    it("should have a link to the third-party content notices", () => {
      pageObject.footer().containsALinkToTheThirdPartyContentNotices();
    });
  });

  describe("final section", () => {
    it("should have a link to tobysmith.uk", () => {
      pageObject.footer().containsALinkToTobySmithDotUk();
    });
  });
});
