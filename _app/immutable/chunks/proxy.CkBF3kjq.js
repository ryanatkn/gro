import{S as w,a,s as m,b as c,m as h,g as y,c as R,u as P}from"./runtime.DT7e6tCC.js";import{i as x,o as O,a as S,d as T,b as E,U as u,g as b,c as I}from"./disclose-version.CH8sjwdA.js";function _(e,t=!0,s=null,f){if(typeof e=="object"&&e!=null&&!x(e)&&!(w in e)){if(a in e){const i=e[a];if(i.t===e||i.p===e)return i.p}const n=I(e);if(n===O||n===S){const i=new Proxy(e,A);return T(e,a,{value:{s:new Map,v:m(0),a:E(e),i:t,p:i,t:e},writable:!0,enumerable:!1}),i}}return e}function g(e,t=1){c(e,e.v+t)}const A={defineProperty(e,t,s){if(s.value){const f=e[a],n=f.s.get(t);n!==void 0&&c(n,_(s.value,f.i,f))}return Reflect.defineProperty(e,t,s)},deleteProperty(e,t){const s=e[a],f=s.s.get(t),n=s.a,i=delete e[t];if(n&&i){const o=s.s.get("length"),l=e.length-1;o!==void 0&&o.v!==l&&c(o,l)}return f!==void 0&&c(f,u),i&&g(s.v),i},get(e,t,s){var i;if(t===a)return Reflect.get(e,a);const f=e[a];let n=f.s.get(t);if(n===void 0&&(!(t in e)||(i=b(e,t))!=null&&i.writable)&&(n=(f.i?m:h)(_(e[t],f.i,f)),f.s.set(t,n)),n!==void 0){const o=y(n);return o===u?void 0:o}return Reflect.get(e,t,s)},getOwnPropertyDescriptor(e,t){const s=Reflect.getOwnPropertyDescriptor(e,t);if(s&&"value"in s){const n=e[a].s.get(t);n&&(s.value=y(n))}return s},has(e,t){var i;if(t===a)return!0;const s=e[a],f=Reflect.has(e,t);let n=s.s.get(t);return(n!==void 0||R!==null&&(!f||(i=b(e,t))!=null&&i.writable))&&(n===void 0&&(n=(s.i?m:h)(f?_(e[t],s.i,s):u),s.s.set(t,n)),y(n)===u)?!1:f},set(e,t,s,f){const n=e[a];let i=n.s.get(t);i===void 0&&(P(()=>f[t]),i=n.s.get(t)),i!==void 0&&c(i,_(s,n.i,n));const o=n.a,l=!(t in e);if(o&&t==="length")for(let r=s;r<e.length;r+=1){const d=n.s.get(r+"");d!==void 0&&c(d,u)}if(e[t]=s,l){if(o){const r=n.s.get("length"),d=e.length;r!==void 0&&r.v!==d&&c(r,d)}g(n.v)}return!0},ownKeys(e){const t=e[a];return y(t.v),Reflect.ownKeys(e)}};export{_ as p};
