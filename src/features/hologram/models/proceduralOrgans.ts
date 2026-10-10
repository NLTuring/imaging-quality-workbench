import { BufferGeometry, Euler, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { createNoise3D } from 'simplex-noise';
import { hashBytes, seededRandom } from '../imaging/seededMapping.ts';
import type { ImageAnalysis, OrganPart, OrganType } from '../types';

/** Convex cap for our closed, approximately convex organ parts (not arbitrary clinical meshes). */
export function createSliceCap(geometry: BufferGeometry, y: number): BufferGeometry | null {
  const attribute = geometry.getAttribute('position'), indices = geometry.index;
  const points: [number, number][] = [];
  const count = indices?.count ?? attribute.count;
  for (let offset = 0; offset < count; offset += 3) {
    const triangle = [0,1,2].map(index => indices ? indices.getX(offset + index) : offset + index);
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3];
      const ay = attribute.getY(a), by = attribute.getY(b);
      if ((ay < y && by >= y) || (by < y && ay >= y)) {
        const t = (y - ay) / (by - ay);
        points.push([attribute.getX(a) + (attribute.getX(b) - attribute.getX(a)) * t, attribute.getZ(a) + (attribute.getZ(b) - attribute.getZ(a)) * t]);
      }
    }
  }
  if (points.length < 3) return null;
  points.sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (a:number[],b:number[],c:number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower: [number,number][] = [], upper: [number,number][] = [];
  for(const p of points) { while(lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop(); lower.push(p); }
  for(const p of [...points].reverse()) { while(upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0,-1),...upper.slice(0,-1)];
  if(hull.length<3) return null;
  const cx = hull.reduce((sum,p)=>sum+p[0],0)/hull.length, cz = hull.reduce((sum,p)=>sum+p[1],0)/hull.length;
  const positions=[cx,y,cz], faces:number[]=[];
  hull.forEach((p,index)=>{positions.push(p[0],y,p[1]);faces.push(0,index+1,(index+1)%hull.length+1);});
  const cap=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
  cap.setIndex(faces);cap.computeVertexNormals();return cap;
}

export function createOrganGeometry(type: OrganType, part: OrganPart, segments: number, analysis?: ImageAnalysis | null) {
  const geometry = new SphereGeometry(1, segments, segments);
  const positions = geometry.getAttribute('position');
  const noise = createNoise3D(seededRandom(hashBytes(new TextEncoder().encode(part.id), analysis?.seed ?? 37)));
  const point = new Vector3(); const rotation = new Euler(...(part.rotation ?? [0, 0, 0]));
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const side = analysis?.sampleSize ?? 1;
    const sx = Math.min(side - 1, Math.floor((x + 1) * 0.5 * side));
    const sy = Math.min(side - 1, Math.floor((1 - y) * 0.5 * side));
    const relief = analysis?.relief[sy * side + sx] ?? 0.5;
    let displacement = 1 + noise(x * 2, y * 2, z * 2) * 0.035 + (relief - 0.5) * 0.06;
    if (type === 'brain') displacement += Math.sin(x * 18 + Math.sin(y * 11)) * Math.cos(z * 17 + y * 8) * 0.05;
    let px = x, py = y;
    if (type === 'lungs') { px *= 1 - Math.max(y, 0) * 0.16; if (py < -0.8) py = -0.8 + (py + 0.8) * 0.5; }
    if (type === 'heart') px *= 0.82 + (y + 1) * 0.16;
    if (type === 'liver') { py = Math.max(-0.7, y); py += x * 0.09; }
    point.set(px * part.scale[0], py * part.scale[1], z * part.scale[2]).multiplyScalar(displacement).applyEuler(rotation).add(new Vector3(...part.position));
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
