import { FooterComponent } from "../../support/page-objects/components/footer";
import { CookiesPageObject } from "../../support/page-objects/cookies.po";
import { DocsPageObject } from "../../support/page-objects/docs.po";
import { IndexPageObject } from "../../support/page-objects/index.po";
import { PermissivePageObject } from "../../support/page-objects/permissive.po";
import { PrivacyPageObject } from "../../support/page-objects/privacy.po";
import { ShieldPageObject } from "../../support/page-objects/shield.po";
import { TermsPageObject } from "../../support/page-objects/terms.po";
import { ThirdPartyPageObject } from "../../support/page-objects/third-party.po";

type PageWithFooter = {
  footer(): FooterComponent;
};

type Fixture = [string, PageWithFooter];

describe("Footer", () => {
  const fixtures: Fixture[] = [
    ["/", new IndexPageObject()],
    ["/docs", new DocsPageObject()],
    ["/permissive", new PermissivePageObject()],
    ["/shield", new ShieldPageObject()],
    ["/terms", new TermsPageObject()],
    ["/privacy", new PrivacyPageObject()],
    ["/cookies", new CookiesPageObject()],
    ["/third-party", new ThirdPartyPageObject()]
  ];

  fixtures.forEach(([path, pageWithFooterObject]) =>
    describe(`on the ${path} page`, () => {
      beforeEach(() => {
        cy.visit(path);
        pageWithFooterObject = new IndexPageObject();
      });

      describe("first column", () => {
        it("should have a link to the index", () => {
          pageWithFooterObject.footer().containsAnIndexLink();
        });

        it("should have a link to the docs", () => {
          pageWithFooterObject.footer().containsADocsLink();
        });

        it("should have a link to the permissive package docs", () => {
          pageWithFooterObject.footer().containsAPermissiveLink();
        });

        it("should have a link to the shield page", () => {
          pageWithFooterObject.footer().containsAShieldLink();
        });
      });

      describe("second column", () => {
        it("should have a link to the GitHub repository", () => {
          pageWithFooterObject.footer().containsALinkToGitHub();
        });

        it("should have a link to the npm page", () => {
          pageWithFooterObject.footer().containsALinkToNpm();
        });
      });

      describe("third column", () => {
        it("should have a link to the terms and conditions", () => {
          pageWithFooterObject.footer().containsALinkToTheTermsAndConditions();
        });

        it("should have a link to the privacy policy", () => {
          pageWithFooterObject.footer().containsALinkToThePrivacyPolicy();
        });

        it("should have a link to the cookies policy", () => {
          pageWithFooterObject.footer().containsALinkToTheCookiesPolicy();
        });

        it("should have a link to the third-party content notices", () => {
          pageWithFooterObject.footer().containsALinkToTheThirdPartyContentNotices();
        });
      });

      describe("final section", () => {
        it("should have a link to tobysmith.uk", () => {
          pageWithFooterObject.footer().containsALinkToTobySmithDotUk();
        });
      });
    })
  );
});
