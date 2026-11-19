/**
 * Runs inside the app page when it is shown in the jsctrls designer canvas
 * (an iframe whose URL has ?jc-design). It never runs in a normal page load.
 *
 * Messages to the designer:   { source: "jsctrls-canvas", type: "select", src }
 * Messages from the designer: { source: "jsctrls-designer", type: "highlight", src | null }
 *
 * src is "<absolute file>#<start offset>", written by the jsctrls Vite plugin.
 * A component that does not pass data-jc-src to the DOM is still found: the
 * overlay walks React's fiber tree from the clicked DOM node up to the
 * nearest element whose props carry the attribute.
 */
export const OVERLAY_SCRIPT = String.raw`
(() => {
  if (window.parent === window || !new URLSearchParams(location.search).has("jc-design")) return;
  const ATTR = "data-jc-src";

  function fiberOf(node) {
    for (const key in node) {
      if (key.startsWith("__reactFiber$")) return node[key];
    }
    return null;
  }

  // The nearest JSX element that produced this DOM node.
  function srcOf(node) {
    for (let el = node; el && el !== document.body; el = el.parentElement) {
      for (let fiber = fiberOf(el); fiber; fiber = fiber.return) {
        const src = fiber.memoizedProps && fiber.memoizedProps[ATTR];
        if (src) return src;
      }
    }
    return null;
  }

  // All top-level DOM nodes rendered for one JSX element.
  function nodesFor(src) {
    const found = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (srcOf(el) !== src) continue;
      if (el.parentElement && srcOf(el.parentElement) === src) continue;
      found.push(el);
    }
    return found;
  }

  function box(color, dashed) {
    const b = document.createElement("div");
    b.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;display:none;" +
      "border:2px " + (dashed ? "dashed " : "solid ") + color;
    document.documentElement.appendChild(b);
    return b;
  }
  const hoverBox = box("#7aa2f7", true);
  const selectBox = box("#e0712c", false);
  let selected = null;

  function place(b, src) {
    const nodes = src ? nodesFor(src) : [];
    if (nodes.length === 0) { b.style.display = "none"; return; }
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      top = Math.min(top, r.top); left = Math.min(left, r.left);
      right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
    }
    Object.assign(b.style, {
      display: "block", top: top + "px", left: left + "px",
      width: right - left + "px", height: bottom - top + "px",
    });
  }

  document.addEventListener("mousemove", (event) => place(hoverBox, srcOf(event.target)), true);
  document.addEventListener("mouseleave", () => place(hoverBox, null), true);
  for (const type of ["click", "mousedown", "mouseup", "dblclick", "submit"]) {
    document.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (type !== "click") return;
      const src = srcOf(event.target);
      if (src) {
        selected = src;
        place(selectBox, src);
        window.parent.postMessage({ source: "jsctrls-canvas", type: "select", src }, "*");
      }
    }, true);
  }
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m && m.source === "jsctrls-designer" && m.type === "highlight") {
      selected = m.src;
      place(selectBox, selected);
    }
  });
  const refresh = () => place(selectBox, selected);
  window.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);
  new MutationObserver(refresh).observe(document.body, { subtree: true, childList: true, attributes: true });
  window.parent.postMessage({ source: "jsctrls-canvas", type: "ready" }, "*");
})();
`;
