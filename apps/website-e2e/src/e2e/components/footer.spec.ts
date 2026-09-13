import { Page, test } from "@playwright/test";
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

type Fixture = [string, (page: Page) => PageWithFooter];

test.describe("Footer", () => {
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
      let pageWithFooterObject: PageWithFooter;

      test.beforeEach(async ({ page }) => {
        await page.goto(path);
        pageWithFooterObject = createPageObject(page);
      });

      test.describe("first column", () => {
        test("should have a link to the index", async () => {
          await pageWithFooterObject.footer().containsAnIndexLink();
        });

        test("should have a link to the docs", async () => {
          await pageWithFooterObject.footer().containsADocsLink();
        });

        test("should have a link to the permissive package docs", async () => {
          await pageWithFooterObject.footer().containsAPermissiveLink();
        });

        test("should have a link to the shield page", async () => {
          await pageWithFooterObject.footer().containsAShieldLink();
        });
      });

      test.describe("second column", () => {
        test("should have a link to the GitHub repository", async () => {
          await pageWithFooterObject.footer().containsALinkToGitHub();
        });

        test("should have a link to the npm page", async () => {
          await pageWithFooterObject.footer().containsALinkToNpm();
        });
      });

      test.describe("third column", () => {
        test("should have a link to the terms and conditions", async () => {
          await pageWithFooterObject.footer().containsALinkToTheTermsAndConditions();
        });

        test("should have a link to the privacy policy", async () => {
          await pageWithFooterObject.footer().containsALinkToThePrivacyPolicy();
        });

        test("should have a link to the cookies policy", async () => {
          await pageWithFooterObject.footer().containsALinkToTheCookiesPolicy();
        });

        test("should have a link to the third-party content notices", async () => {
          await pageWithFooterObject.footer().containsALinkToTheThirdPartyContentNotices();
        });
      });

      test.describe("final section", () => {
        test("should have a link to tobysmith.uk", async () => {
          await pageWithFooterObject.footer().containsALinkToTobySmithDotUk();
        });
      });
    })
  );
});
