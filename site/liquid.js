import * as THREE from "three";

const TEXEL = .7, REACH = 3, BLUR = 2;

const VS = `\nvarying vec2 vUv;\nvoid main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BLUR_FS = `\nuniform sampler2D uT;\nuniform vec2 uD;\nvarying vec2 vUv;\nvoid main() {\n  gl_FragColor = texture2D(uT, vUv) * 0.375 + (texture2D(uT, vUv + uD) + texture2D(uT, vUv - uD)) * 0.25 + (texture2D(uT, vUv + uD * 2.0) + texture2D(uT, vUv - uD * 2.0)) * 0.0625;\n}`;

const SPLAT_VS = `\nuniform vec4 uRect;\nuniform float uR, uSize;\nattribute vec3 aCol;\nvarying vec3 vC;\nvoid main() {\n  vec2 w = position.xy * uR, uv = (w - uRect.xy) / (uRect.zw - uRect.xy);\n  vC = aCol;\n  gl_PointSize = uSize;\n  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);\n}`;

const SPLAT_FS = `\nvarying vec3 vC;\nvoid main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard; float w = (1.0 - r2) * (1.0 - r2); gl_FragColor = vec4(vC * w, w); }`;

export function makeLiquid(renderer, dropGeo) {
  const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping
  });
  const quadScene = new THREE.Scene, quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blur = new THREE.ShaderMaterial({
    vertexShader: VS,
    fragmentShader: BLUR_FS,
    uniforms: {
      uT: {
        value: null
      },
      uD: {
        value: new THREE.Vector2
      }
    },
    depthTest: false,
    depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const uni = {
    uRect: {
      value: new THREE.Vector4
    },
    uR: {
      value: 1
    },
    uSize: {
      value: 4
    }
  };
  const pts = new THREE.Points(dropGeo, new THREE.ShaderMaterial({
    vertexShader: SPLAT_VS,
    fragmentShader: SPLAT_FS,
    uniforms: uni,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor
  }));
  pts.frustumCulled = false;
  const sPts = new THREE.Scene;
  sPts.add(pts);
  const cc = new THREE.Color;
  let S = null;
  function layout({rect, r, rp}) {
    const tx = rp * r * TEXEL, w = Math.max(16, Math.min(1400, Math.round((rect[2] - rect[0]) / tx)));
    const c = (rect[2] - rect[0]) / w, h = Math.max(16, Math.round((rect[3] - rect[1]) / c));
    if (S) {
      S.a.dispose();
      S.b.dispose();
    }
    S = {
      w,
      h,
      r,
      rp,
      R: new THREE.Vector4(rect[0], rect[1], rect[2], rect[1] + h * c),
      a: rt(w, h),
      b: rt(w, h)
    };
  }
  function withState(fn) {
    const prev = renderer.getRenderTarget(), ca = renderer.getClearAlpha(), ac = renderer.autoClear;
    renderer.getClearColor(cc);
    renderer.setClearColor(0, 0);
    renderer.autoClear = true;
    try {
      fn();
    } finally {
      renderer.setRenderTarget(prev);
      renderer.setClearColor(cc, ca);
      renderer.autoClear = ac;
    }
  }
  function draw(n) {
    if (!S) return;
    const {w, h, R, r, rp} = S;
    uni.uRect.value.copy(R);
    uni.uR.value = r;
    uni.uSize.value = 2 * REACH * rp * r / ((R.z - R.x) / w);
    withState(() => {
      dropGeo.drawRange.count = n;
      renderer.setRenderTarget(S.a);
      renderer.clear();
      if (n) renderer.render(sPts, quadCam);
      quad.material = blur;
      for (let i = 0; i < BLUR; i++) {
        blur.uniforms.uT.value = S.a.texture;
        blur.uniforms.uD.value.set(1 / w, 0);
        renderer.setRenderTarget(S.b);
        renderer.render(quadScene, quadCam);
        blur.uniforms.uT.value = S.b.texture;
        blur.uniforms.uD.value.set(0, 1 / h);
        renderer.setRenderTarget(S.a);
        renderer.render(quadScene, quadCam);
      }
    });
  }
  return {
    layout,
    draw,
    get texture() {
      return S ? S.a.texture : null;
    },
    get rect() {
      return S ? S.R : null;
    },
    get texel() {
      return S ? [ 1 / S.w, 1 / S.h ] : [ 0, 0 ];
    },
    get size() {
      return S ? {
        w: S.w,
        h: S.h
      } : null;
    },
    get target() {
      return S ? S.a : null;
    }
  };
}
