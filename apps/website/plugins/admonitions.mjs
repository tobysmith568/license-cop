import octicons from "@primer/octicons";
import { h } from "hastscript";
import { visit } from "unist-util-visit";

const admonitionTypes = {
  important: { cssClass: "admonition-important", iconClass: "alert", title: "Important" },
  tip: { cssClass: "admonition-tip", iconClass: "light-bulb", title: "Tip" },
  note: { cssClass: "admonition-note", iconClass: "info", title: "Note" },
  caution: { cssClass: "admonition-caution", iconClass: "alert", title: "Caution" },
  warning: { cssClass: "admonition-warning", iconClass: "flame", title: "Warning" }
};

const admonitionsPlugin = () => {
  return tree => {
    visit(tree, node => {
      if (
        node.type === "textDirective" ||
        node.type === "leafDirective" ||
        node.type === "containerDirective"
      ) {
        if (!Object.keys(admonitionTypes).includes(node.name)) {
          return;
        }

        const boxInfo = admonitionTypes[node.name];

        // Adding CSS classes according to the type.
        const data = node.data || (node.data = {});
        const tagName = node.type === "textDirective" ? "span" : "div";
        data.hName = tagName;
        data.hProperties = h(tagName, { class: `admonition ${boxInfo.cssClass}` }).properties;

        const literalSvg = octicons[boxInfo.iconClass].toSVG({
          width: 24,
          height: 24,
          xmlns: "http://www.w3.org/2000/svg"
        });

        // Creating the icon.
        const icon = h("img");
        const iconData = icon.data || (icon.data = {});
        iconData.hName = "img";
        iconData.hProperties = h("img", {
          class: `admonition-icon`,
          src: `data:image/svg+xml;utf8,${literalSvg}`
        }).properties;

        // Creating the title.
        const title = h("strong");
        const titleData = title.data || (title.data = {});
        titleData.hName = "strong";
        titleData.hProperties = h("strong", { class: "md-admonition-title" }).properties;
        title.children = [h("span", node.attributes.title ?? boxInfo.title)];

        // Creating the icon's row.
        const iconWrapper = h("div");
        const iconWrapperData = iconWrapper.data || (iconWrapper.data = {});
        iconWrapperData.hName = "div";
        iconWrapperData.hProperties = h("div", { class: "row title-row" }).properties;
        iconWrapper.children = [icon, title];

        // Creating the content's row.
        const contentRowWrapper = h("div");
        const contentRowWrapperData = contentRowWrapper.data || (contentRowWrapper.data = {});
        contentRowWrapperData.hName = "div";
        contentRowWrapperData.hProperties = h("div", { class: "row" }).properties;
        contentRowWrapper.children = [...node.children]; // Adding markdown's content block.

        // Creating the row's wrapper.
        const rowsWrapper = h("div");
        const rowsWrapperData = rowsWrapper.data || (rowsWrapper.data = {});
        rowsWrapperData.hName = "div";
        rowsWrapperData.hProperties = h("div", { class: "rows" }).properties;
        rowsWrapper.children = [iconWrapper, contentRowWrapper];

        // Creating the wrapper for the admonition's content.
        const contentWrapper = h("div");
        const wrapperData = contentWrapper.data || (contentWrapper.data = {});
        wrapperData.hName = "div";
        wrapperData.hProperties = h("div", { class: "message-body" }).properties;
        contentWrapper.children = [rowsWrapper];
        node.children = [contentWrapper];
      }
    });
  };
};

export default admonitionsPlugin;
