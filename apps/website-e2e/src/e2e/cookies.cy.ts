import { CookiesPageObject } from "../support/page-objects/cookies.po";

describe("Cookies", () => {
  let pageObject: CookiesPageObject;

  beforeEach(() => {
    cy.visit("/cookies");
    pageObject = new CookiesPageObject();
  });

  it("should display the main heading", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the Contact Us heading", () => {
    pageObject.containsTheContactUsHeading();
  });
});
