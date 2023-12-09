import { HeaderComponent } from "../../support/page-objects/components/header";
import { CookiesPageObject } from "../../support/page-objects/cookies.po";
import { DocsPageObject } from "../../support/page-objects/docs.po";
import { IndexPageObject } from "../../support/page-objects/index.po";
import { PermissivePageObject } from "../../support/page-objects/permissive.po";
import { PrivacyPageObject } from "../../support/page-objects/privacy.po";
import { ShieldPageObject } from "../../support/page-objects/shield.po";
import { TermsPageObject } from "../../support/page-objects/terms.po";
import { ThirdPartyPageObject } from "../../support/page-objects/third-party.po";

type PageWithHeader = {
  header(): HeaderComponent;
};

type Fixture = [string, PageWithHeader];

describe("Header", () => {
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

  fixtures.forEach(([path, pageWithHeaderObject]) =>
    describe(`on the ${path} page`, () => {
      beforeEach(() => {
        cy.visit(path);
      });

      it("should have a link to the index", () => {
        pageWithHeaderObject.header().containsAnIndexLink();
      });

      it("should have a link to the docs", () => {
        pageWithHeaderObject.header().containsADocsLink();
      });

      it("should have a link to the permissive package docs", () => {
        pageWithHeaderObject.header().containsAPermissiveLink();
      });

      it("should have a link to the shield page", () => {
        pageWithHeaderObject.header().containsAShieldLink();
      });

      it("should have a link to the GitHub repository", () => {
        pageWithHeaderObject.header().containsALinkToGitHub();
      });

      it("should have a link to the npm page", () => {
        pageWithHeaderObject.header().containsALinkToNpm();
      });
    })
  );
});
