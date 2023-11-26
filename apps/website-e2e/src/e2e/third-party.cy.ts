import { ThirdPartyPageObject } from "../support/page-objects/third-party.po";

describe("ThirdParty", () => {
  let pageObject: ThirdPartyPageObject;

  beforeEach(() => {
    cy.visit("/third-party");
    pageObject = new ThirdPartyPageObject();
  });

  it("should display the main heading", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the Sources heading", () => {
    pageObject.containsTheSourcesHeading();
  });

  it("should display the Licenses heading", () => {
    pageObject.containsTheLicensesHeading();
  });

  it("should display the generate-license-file content", () => {
    pageObject.containsTheGenerateLicenseFileContent();
  });
});
