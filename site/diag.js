if (new URLSearchParams(location.search).has("diag")) (() => {
  const log = [], add = s => {
    log.push(String(s).slice(0, 300));
  };
  for (const k of [ "error", "warn" ]) {
    const f = console[k];
    console[k] = (...a) => {
      add(k + ": " + a.map(x => x && x.stack ? x.message : typeof x === "object" ? JSON.stringify(x) : x).join(" "));
      f.apply(console, a);
    };
  }
  addEventListener("error", e => add("page error: " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  addEventListener("unhandledrejection", e => add("rejected: " + (e.reason && e.reason.message || e.reason)));
  const info = [];
  try {
    const c = document.createElement("canvas"), g2 = c.getContext("webgl2"), g = g2 || c.getContext("webgl");
    info.push("webgl2: " + !!g2 + ", webgl: " + !!g);
    if (g) {
      const d = g.getExtension("WEBGL_debug_renderer_info");
      info.push("gpu: " + (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) + " / " + g.getParameter(d.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.RENDERER)));
      info.push("version: " + g.getParameter(g.VERSION));
      const hp = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
      info.push("frag highp: " + hp.precision + ", max tex " + g.getParameter(g.MAX_TEXTURE_SIZE) + (g2 ? ", max samples " + g2.getParameter(g2.MAX_SAMPLES) : "") + ", vert uniforms " + g.getParameter(g.MAX_VERTEX_UNIFORM_VECTORS) + ", frag uniforms " + g.getParameter(g.MAX_FRAGMENT_UNIFORM_VECTORS));
      const want = [ "EXT_color_buffer_float", "EXT_color_buffer_half_float", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_float_blend" ];
      const have = g.getSupportedExtensions() || [];
      info.push("ext: " + want.map(x => x.replace(/^(EXT|OES)_/, "") + (have.includes(x) ? " yes" : " NO")).join(", "));
    }
  } catch (e) {
    info.push("probe failed: " + e.message);
  }
  info.push("dpr " + devicePixelRatio + ", screen " + screen.width + "x" + screen.height + ", direct " + new URLSearchParams(location.search).has("direct"));
  info.push(navigator.userAgent);
  addEventListener("DOMContentLoaded", () => {
    const box = document.createElement("pre");
    box.style.cssText = "box-sizing:border-box;position:fixed;left:6px;right:6px;bottom:6px;max-height:55vh;overflow:auto;z-index:99999;margin:0;padding:8px;background:#fff;color:#000;font:11px/1.35 monospace;white-space:pre-wrap;word-break:break-all;border:2px solid #f00";
    document.body.appendChild(box);
    const NL = String.fromCharCode(10);
    const draw = () => {
      box.textContent = [ "DIAG (screenshot this)", ...info, "--- errors and warnings (" + log.length + ") ---", ...log.length ? log : [ "none" ] ].join(NL);
    };
    draw();
    setInterval(draw, 1e3);
  });
})();
