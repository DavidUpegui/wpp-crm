import { createCn } from "cn/config";

/** Class merger that knows our named font-size tokens (globals.css), so `text-meta` is a size, not a colour. */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["meta", "body", "section", "page", "display"] }] } },
});
