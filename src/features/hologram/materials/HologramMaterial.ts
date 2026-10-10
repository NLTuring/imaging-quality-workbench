import { Color, DoubleSide, NormalBlending, ShaderMaterial, AdditiveBlending } from 'three';
import { COLORS } from '../quality.config';

export function createHologramMaterial(wire = false) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending, wireframe: wire,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uClip: { value: 3 }, uHover: { value: 0 }, uWarning: { value: 0 }, uWire: { value: wire ? 1 : 0 }, uColor: { value: new Color(COLORS.cyan) }, uPink: { value: new Color(COLORS.pink) } },
    vertexShader: `
      varying vec3 vNormalW; varying vec3 vView; varying vec3 vLocal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - world.xyz; vLocal = position;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uReveal, uClip, uHover, uWarning, uWire;
      uniform vec3 uColor, uPink;
      varying vec3 vNormalW; varying vec3 vView; varying vec3 vLocal;
      float hash(vec3 p) { return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main() {
        float top = uReveal * 2.65 - 0.12;
        if (vLocal.y > top || vLocal.y > uClip) discard;
        float rim = pow(1.0-abs(dot(normalize(vNormalW),normalize(vView))),2.0);
        float stripe = pow(0.5+0.5*sin(vLocal.y*130.0-uTime*2.4),15.0);
        float speckle = hash(floor(vLocal*180.0)+floor(uTime*9.0))*0.025;
        float frontier = exp(-abs(vLocal.y-top)*55.0)*(1.0-step(0.999,uReveal));
        float cutRim = exp(-abs(vLocal.y-uClip)*85.0);
        vec3 color = mix(uColor,uPink,uWarning*0.82);
        float light = 0.20+rim*1.3+stripe*0.13+frontier*1.2+cutRim*0.8+uHover*0.5;
        float alpha = (0.13+rim*0.49+stripe*0.025+speckle+uHover*0.12)*(1.0-uWire*0.68);
        gl_FragColor = vec4(color*light,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
export function createBeamMaterial() {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uScan: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv;uniform float uTime,uStrength,uScan;void main(){
      float rays=0.6+0.4*pow(0.5+0.5*sin(vUv.x*80.0+uTime*0.35),4.0);
      float sweep=exp(-abs(vUv.y-fract(uScan*2.0))*30.0);
      float alpha=(0.013+rays*0.018+sweep*0.085)*uStrength*(1.0-vUv.y*0.65);
      gl_FragColor=vec4(0.0,0.64,0.9,alpha);
      #include <colorspace_fragment>
    }`,
  });
}
