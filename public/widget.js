(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__inbexoraWidgetLoaded) return;
  var shop = script.getAttribute("data-shop") || "";
  if (!/^[a-z0-9-]{1,100}$/.test(shop)) return;
  window.__inbexoraWidgetLoaded = true;

  var origin = new URL(script.src).origin;
  var root = document.createElement("div");
  root.setAttribute("data-inbexora-widget", shop);
  var shadow = root.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}button{font:600 15px system-ui,sans-serif;cursor:pointer}" +
    ".bubble{position:fixed;right:20px;bottom:20px;z-index:2147483647;min-width:60px;height:60px;padding:0 18px;border:0;border-radius:999px;background:#075d49;color:white;box-shadow:0 6px 24px #0004}" +
    ".panel{position:fixed;right:20px;bottom:92px;z-index:2147483647;width:min(380px,calc(100vw - 24px));height:min(620px,calc(100dvh - 112px));border:1px solid #ddd;border-radius:18px;overflow:hidden;background:white;box-shadow:0 10px 36px #0004}" +
    ".panel[hidden]{display:none}.frame{width:100%;height:100%;border:0}" +
    "@media(max-width:480px){.panel{right:12px;bottom:84px;width:calc(100vw - 24px);height:calc(100dvh - 100px)}.bubble{right:12px;bottom:12px}}";
  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "bubble";
  bubble.textContent = "💬 Chat với shop";
  bubble.setAttribute("aria-label", "Mở chat với shop");
  bubble.setAttribute("aria-expanded", "false");
  var panel = document.createElement("div");
  panel.className = "panel";
  panel.hidden = true;
  var frame = document.createElement("iframe");
  frame.className = "frame";
  frame.title = "Chat với shop";
  frame.loading = "lazy";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.src = origin + "/chat/" + encodeURIComponent(shop) + "?embed=true";
  panel.appendChild(frame);
  bubble.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
    bubble.setAttribute("aria-expanded", String(!panel.hidden));
    bubble.setAttribute("aria-label", panel.hidden ? "Mở chat với shop" : "Đóng chat với shop");
    if (!panel.hidden) frame.focus();
  });
  shadow.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      bubble.setAttribute("aria-expanded", "false");
      bubble.focus();
    }
  });
  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(bubble);
  if (document.body) document.body.appendChild(root);
  else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(root); }, { once: true });
})();
