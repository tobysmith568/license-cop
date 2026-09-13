import { Page, test } from "@playwright/test";
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

type Fixture = [string, (page: Page) => PageWithHeader];

test.describe("Header", () => {
  const fixtures: Fixture[] = [
    ["/", page => new IndexPageObject(page)],
    ["/docs", page => new DocsPageObject(page)],
    ["/permissive", page => new PermissivePageObject(page)],
    ["/shield", page => new ShieldPageObject(page)],
    ["/terms", page => new TermsPageObject(page)],
    ["/privacy", page => new PrivacyPageObject(page)],
    ["/cookies", page => new CookiesPageObject(page)],
    ["/third-party", page => new ThirdPartyPageObject(page)]
  ];

  fixtures.forEach(([path, createPageObject]) =>
    test.describe(`on the ${path} page`, () => {
      let pageWithHeaderObject: PageWithHeader;

      test.beforeEach(async ({ page }) => {
        await page.goto(path);
        pageWithHeaderObject = createPageObject(page);
      });

      test("should have a link to the index", async () => {
        await pageWithHeaderObject.header().containsAnIndexLink();
      });

      test("should have a link to the docs", async () => {
        await pageWithHeaderObject.header().containsADocsLink();
      });

      test("should have a link to the permissive package docs", async () => {
        await pageWithHeaderObject.header().containsAPermissiveLink();
      });

      test("should have a link to the shield page", async () => {
        await pageWithHeaderObject.header().containsAShieldLink();
      });

      test("should have a link to the GitHub repository", async () => {
        await pageWithHeaderObject.header().containsALinkToGitHub();
      });

      test("should have a link to the npm page", async () => {
        await pageWithHeaderObject.header().containsALinkToNpm();
      });
    })
  );
});
