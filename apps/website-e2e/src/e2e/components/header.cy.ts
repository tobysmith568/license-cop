import { IndexPageObject } from "../../support/page-objects/index.po";

describe("Header", () => {
  let pageObject: IndexPageObject;

  beforeEach(() => {
    cy.visit("/");
    pageObject = new IndexPageObject();
  });

  it("should have a link to the index", () => {
    pageObject.header().containsAnIndexLink();
  });

  it("should have a link to the docs", () => {
    pageObject.header().containsADocsLink();
  });

  it("should have a link to the permissive package docs", () => {
    pageObject.header().containsAPermissiveLink();
  });

  it("should have a link to the shield page", () => {
    pageObject.header().containsAShieldLink();
  });

  it("should have a link to the GitHub repository", () => {
    pageObject.header().containsALinkToGitHub();
  });

  it("should have a link to the npm page", () => {
    pageObject.header().containsALinkToNpm();
  });
});
