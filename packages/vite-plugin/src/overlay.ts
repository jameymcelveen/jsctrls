/**
 * Runs inside the app page when it is shown in the jsctrls designer canvas
 * (an iframe whose URL has ?jc-design). It never runs in a normal page load.
 *
 * Messages to the designer:   { source: "jsctrls-canvas", type: "select", src }
 *                             { source: "jsctrls-canvas", type: "move", src, target, position }
 * Messages from the designer: { source: "jsctrls-designer", type: "highlight", src | null }
 *                             { source: "jsctrls-designer", type: "focus", file }
 *
 * A clear "glass" layer covers the page and takes every pointer event, so
 * disabled controls can be selected and the app's own handlers never run.
 * "focus" names the file being designed: a click inside a component (say a
 * ListBox row) selects the <ListBox> in that file, not the library's inner
 * <div>.
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

  let focusFile = null;
  const fileOf = (src) => src.slice(0, src.lastIndexOf("#"));

  // The JSX element that produced this DOM node: the nearest one written in
  // the focus file, else the nearest one at all.
  function srcOf(node) {
    let nearest = null;
    for (let el = node; el && el !== document.documentElement; el = el.parentElement) {
      for (let fiber = fiberOf(el); fiber; fiber = fiber.return) {
        const src = fiber.memoizedProps && fiber.memoizedProps[ATTR];
        if (!src) continue;
        if (!focusFile || fileOf(src) === focusFile) return src;
        if (!nearest) nearest = src;
      }
      if (!focusFile && nearest) return nearest;
    }
    return nearest;
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
    b.setAttribute("data-jc-overlay", "");
    b.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;display:none;" +
      "border:2px " + (dashed ? "dashed " : "solid ") + color;
    document.documentElement.appendChild(b);
    return b;
  }
  const glass = document.createElement("div");
  glass.style.cssText = "position:fixed;inset:0;z-index:2147483646;cursor:default;background:transparent";
  document.documentElement.appendChild(glass);

  // The app element under the pointer, looking through the glass and the boxes.
  function elementAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el !== glass && !el.hasAttribute("data-jc-overlay")) return el;
    }
    return null;
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

  const dropLine = box("#e0712c", false);
  dropLine.style.borderWidth = "2px";
  let drag = null;

  function rectOf(src) {
    const nodes = nodesFor(src);
    if (nodes.length === 0) return null;
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      top = Math.min(top, r.top); left = Math.min(left, r.left);
      right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
    }
    return { top, left, right, bottom };
  }

  // Where a drop at (x, y) lands: before or after the element under the pointer.
  // Siblings laid out side by side split on x; stacked ones split on y.
  function dropAt(x, y) {
    const el = elementAt(x, y);
    const target = el && srcOf(el);
    if (!target || target === drag.src) return null;
    const t = rectOf(target);
    const s = drag.rect;
    if (!t) return null;
    const sideBySide = Math.min(t.bottom, s.bottom) - Math.max(t.top, s.top) > 0.5 * Math.min(t.bottom - t.top, s.bottom - s.top);
    const position = sideBySide
      ? (x < (t.left + t.right) / 2 ? "before" : "after")
      : (y < (t.top + t.bottom) / 2 ? "before" : "after");
    const line = sideBySide
      ? { top: t.top, left: position === "before" ? t.left - 2 : t.right - 2, width: 4, height: t.bottom - t.top }
      : { top: position === "before" ? t.top - 2 : t.bottom - 2, left: t.left, width: t.right - t.left, height: 4 };
    return { target, position, line };
  }

  glass.addEventListener("mousedown", (event) => {
    const el = elementAt(event.clientX, event.clientY);
    const src = el && srcOf(el);
    drag = src ? { src, x: event.clientX, y: event.clientY, active: false, rect: rectOf(src) } : null;
  });

  glass.addEventListener("mousemove", (event) => {
    if (drag && !drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) {
      drag.active = true;
      glass.style.cursor = "grabbing";
    }
    if (drag && drag.active) {
      const drop = dropAt(event.clientX, event.clientY);
      drag.drop = drop;
      place(hoverBox, drop && drop.target);
      if (drop) {
        Object.assign(dropLine.style, {
          display: "block", top: drop.line.top + "px", left: drop.line.left + "px",
          width: drop.line.width + "px", height: drop.line.height + "px", background: "#e0712c",
        });
      } else {
        dropLine.style.display = "none";
      }
      return;
    }
    const el = elementAt(event.clientX, event.clientY);
    place(hoverBox, el && srcOf(el));
  });

  glass.addEventListener("mouseleave", () => place(hoverBox, null));

  glass.addEventListener("mouseup", (event) => {
    const current = drag;
    drag = null;
    glass.style.cursor = "default";
    dropLine.style.display = "none";
    if (current && current.active) {
      if (current.drop) {
        window.parent.postMessage({
          source: "jsctrls-canvas", type: "move",
          src: current.src, target: current.drop.target, position: current.drop.position,
        }, "*");
      }
      return;
    }
    const el = elementAt(event.clientX, event.clientY);
    const src = el && srcOf(el);
    if (src) {
      selected = src;
      place(selectBox, src);
      window.parent.postMessage({ source: "jsctrls-canvas", type: "select", src }, "*");
    }
  });
  // Keys typed while the canvas has focus must not reach the app either.
  document.addEventListener("keydown", (event) => { event.stopPropagation(); }, true);
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m && m.source === "jsctrls-designer" && m.type === "highlight") {
      selected = m.src;
      place(selectBox, selected);
    }
    if (m && m.source === "jsctrls-designer" && m.type === "focus") {
      focusFile = m.file;
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
