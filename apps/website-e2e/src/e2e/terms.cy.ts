import { TermsPageObject } from "../support/page-objects/terms.po";

describe("Terms", () => {
  let pageObject: TermsPageObject;

  beforeEach(() => {
    cy.visit("/terms");
    pageObject = new TermsPageObject();
  });

  it("should display the main heading", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the Contact Us heading", () => {
    pageObject.containsTheContactUsHeading();
  });
});
