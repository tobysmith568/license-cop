import { PrivacyPageObject } from "../support/page-objects/privacy.po";

describe("Privacy", () => {
  let pageObject: PrivacyPageObject;

  beforeEach(() => {
    cy.visit("/privacy");
    pageObject = new PrivacyPageObject();
  });

  it("should display the main heading", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the Contact Us heading", () => {
    pageObject.containsTheContactUsHeading();
  });
});
