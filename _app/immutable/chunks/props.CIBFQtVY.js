import{i as k,S as o,o as z,e as C,f as F,s as E,g as K,h as v,j as w,k as _,l as Z,u as B,m as $,b as G,r as L,c as N,n as x,E as H,q as V,L as J,v as Q,w as q,x as W,y as X}from"./runtime.CEtoiaLM.js";import{U as R,h as g,i as p,j as ee,k as ne,g as te,d as U,b as se,P as ae,l as re,m as fe,n as ie,o as ue}from"./disclose-version.Dd8bO5g7.js";function b(e,n=null,s){if(typeof e=="object"&&e!=null&&!k(e)){if(o in e){const t=e[o];if(t.t===e||t.p===e)return t.p}const a=$(e);if(a===z||a===C){const t=new Proxy(e,le);return F(e,o,{value:{s:new Map,v:E(0),a:K(e),p:t,t:e},writable:!0,enumerable:!1}),t}}return e}function j(e,n=1){v(e,e.v+n)}const le={defineProperty(e,n,s){if(s.value){const a=e[o],t=a.s.get(n);t!==void 0&&v(t,b(s.value,a))}return Reflect.defineProperty(e,n,s)},deleteProperty(e,n){const s=e[o],a=s.s.get(n),t=s.a,r=delete e[n];if(t&&r){const f=s.s.get("length"),c=e.length-1;f!==void 0&&f.v!==c&&v(f,c)}return a!==void 0&&v(a,R),r&&j(s.v),r},get(e,n,s){var r;if(n===o)return Reflect.get(e,o);const a=e[o];let t=a.s.get(n);if(t===void 0&&(!(n in e)||(r=w(e,n))!=null&&r.writable)&&(t=E(b(e[n],a)),a.s.set(n,t)),t!==void 0){const f=_(t);return f===R?void 0:f}return Reflect.get(e,n,s)},getOwnPropertyDescriptor(e,n){const s=Reflect.getOwnPropertyDescriptor(e,n);if(s&&"value"in s){const t=e[o].s.get(n);t&&(s.value=_(t))}return s},has(e,n){var r;if(n===o)return!0;const s=e[o],a=Reflect.has(e,n);let t=s.s.get(n);return(t!==void 0||Z!==null&&(!a||(r=w(e,n))!=null&&r.writable))&&(t===void 0&&(t=E(a?b(e[n],s):R),s.s.set(n,t)),_(t)===R)?!1:a},set(e,n,s,a){const t=e[o];let r=t.s.get(n);r===void 0&&(B(()=>a[n]),r=t.s.get(n)),r!==void 0&&v(r,b(s,t));const f=t.a,c=!(n in e);if(f&&n==="length")for(let i=s;i<e.length;i+=1){const d=t.s.get(i+"");d!==void 0&&v(d,R)}var l=Reflect.getOwnPropertyDescriptor(e,n);if(l!=null&&l.set?l.set.call(a,s):e[n]=s,c){if(f){const i=t.s.get("length"),d=e.length;i!==void 0&&i.v!==d&&v(i,d)}j(t.v)}return!0},ownKeys(e){const n=e[o];return _(n.v),Reflect.ownKeys(e)}};function oe(e,n,s,a=null,t=!1){g&&p();var r=e,f=null,c=null,l=null,i=t?H:0;G(()=>{if(l===(l=!!n()))return;let d=!1;if(g){const m=r.data===ee;l===m&&(r=ne(),te(r),U(!1),d=!0)}l?(f?L(f):f=N(()=>s(r)),c&&x(c,()=>{c=null})):(c?L(c):a&&(c=N(()=>a(r))),f&&x(f,()=>{f=null})),d&&U(!0)},i),g&&(r=se)}function _e(e,n,s,a){var O;var t=(s&re)!==0,r=(s&fe)!==0,f=(s&ie)!==0,c=(s&ue)!==0,l=e[n],i=(O=w(e,n))==null?void 0:O.set,d=a,m=!0,A=()=>(c&&m&&(m=!1,d=B(a)),d);l===void 0&&a!==void 0&&(i&&r&&V(),l=A(),i&&i(l));var y;if(r)y=()=>{var u=e[n];return u===void 0?A():(m=!0,u)};else{var T=(t?q:W)(()=>e[n]);T.f|=J,y=()=>{var u=_(T);return u!==void 0&&(d=void 0),u===void 0?d:u}}if(!(s&ae))return y;if(i){var M=e.$$legacy;return function(u,h){return arguments.length>0?((!r||!h||M)&&i(h?y():u),u):y()}}var S=!1,I=X(l),P=q(()=>{var u=y(),h=_(I);return S?(S=!1,h):I.v=u});return t||(P.equals=Q),function(u,h){var Y=_(P);if(arguments.length>0){const D=h?_(P):r&&f?b(u):u;return P.equals(D)||(S=!0,v(I,D),_(P)),u}return Y}}export{b as a,oe as i,_e as p};
