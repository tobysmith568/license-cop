import { ShieldPageObject } from "../support/page-objects/shield.po";

describe("Shield", () => {
  let pageObject: ShieldPageObject;

  beforeEach(() => {
    cy.visit("/shield");
    pageObject = new ShieldPageObject();
  });

  it("should display the main heading", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the badge", () => {
    pageObject.containsTheBadge();
  });

  it("should display the html header", () => {
    pageObject.containsTheHtmlHeader();
  });

  it("should display the markdown header", () => {
    pageObject.containsTheMarkdownHeader();
  });
});
