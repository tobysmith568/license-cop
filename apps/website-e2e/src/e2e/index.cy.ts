import { IndexPageObject } from "../support/page-objects/index.po";

describe("Index", () => {
  let pageObject: IndexPageObject;

  beforeEach(() => {
    cy.visit("/");
    pageObject = new IndexPageObject();
  });

  it("should display the hero title", () => {
    pageObject.hero().containsTheTitle();
  });
});
