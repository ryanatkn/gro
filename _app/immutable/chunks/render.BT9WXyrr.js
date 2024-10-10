import{a0 as R,I as O,a1 as V,a2 as b,l as M,e as W,g as q,q as E,i as w,j as L,m as B,k as y,a3 as C,o as H,a4 as Y,a5 as j,a6 as P,a7 as $,b as z,n as G,p as U,h as T,D as F,a as J,a8 as K}from"./runtime.BXqBLEo1.js";import{r as Q}from"./svelte-head.DRiYgYba.js";import{b as X}from"./disclose-version.DbL4tQjl.js";const D=new Set,S=new Set;function st(t,e,a,u){function s(r){if(u.capture||g.call(e,r),!r.cancelBubble)return a.call(this,r)}return t.startsWith("pointer")||t.startsWith("touch")||t==="wheel"?V(()=>{e.addEventListener(t,s,u)}):e.addEventListener(t,s,u),s}function it(t){for(var e=0;e<t.length;e++)D.add(t[e]);for(var a of S)a(t)}function g(t){var A;var e=this,a=e.ownerDocument,u=t.type,s=((A=t.composedPath)==null?void 0:A.call(t))||[],r=s[0]||t.target,d=0,_=t.__root;if(_){var l=s.indexOf(_);if(l!==-1&&(e===document||e===window)){t.__root=e;return}var c=s.indexOf(e);if(c===-1)return;l<=c&&(d=l)}if(r=s[d]||t.target,r!==e){R(t,"currentTarget",{configurable:!0,get(){return r||a}});try{for(var h,i=[];r!==null;){var n=r.assignedSlot||r.parentNode||r.host||null;try{var o=r["__"+u];if(o!==void 0&&!r.disabled)if(O(o)){var[f,...m]=o;f.apply(r,[t,...m])}else o.call(r,t)}catch(v){h?i.push(v):h=v}if(t.cancelBubble||n===e||n===null)break;r=n}if(h){for(let v of i)queueMicrotask(()=>{throw v});throw h}}finally{t.__root=e,delete t.currentTarget}}}function ut(t){return t.endsWith("capture")&&t!=="gotpointercapture"&&t!=="lostpointercapture"}const Z=["beforeinput","click","change","dblclick","contextmenu","focusin","focusout","input","keydown","keyup","mousedown","mousemove","mouseout","mouseover","mouseup","pointerdown","pointermove","pointerout","pointerover","pointerup","touchend","touchmove","touchstart"];function dt(t){return Z.includes(t)}const x={formnovalidate:"formNoValidate",ismap:"isMap",nomodule:"noModule",playsinline:"playsInline",readonly:"readOnly"};function lt(t){return t=t.toLowerCase(),x[t]??t}const tt=["touchstart","touchmove"];function et(t){return tt.includes(t)}let N=!0;function ct(t,e){var a=e==null?"":typeof e=="object"?e+"":e;a!==(t.__t??(t.__t=t.nodeValue))&&(t.__t=a,t.nodeValue=a==null?"":a+"")}function rt(t,e){return I(t,e)}function ft(t,e){b(),e.intro=e.intro??!1;const a=e.target,u=T,s=y;try{for(var r=M(a);r&&(r.nodeType!==8||r.data!==W);)r=q(r);if(!r)throw E;w(!0),L(r),B();const d=I(t,{...e,anchor:r});if(y===null||y.nodeType!==8||y.data!==C)throw H(),E;return w(!1),d}catch(d){if(d===E)return e.recover===!1&&Y(),b(),j(a),w(!1),rt(t,e);throw d}finally{w(u),L(s),Q()}}const p=new Map;function I(t,{target:e,anchor:a,props:u={},events:s,context:r,intro:d=!0}){b();var _=new Set,l=i=>{for(var n=0;n<i.length;n++){var o=i[n];if(!_.has(o)){_.add(o);var f=et(o);e.addEventListener(o,g,{passive:f});var m=p.get(o);m===void 0?(document.addEventListener(o,g,{passive:f}),p.set(o,1)):p.set(o,m+1)}}};l(P(D)),S.add(l);var c=void 0,h=$(()=>{var i=a??e.appendChild(z());return G(()=>{if(r){U({});var n=K;n.c=r}s&&(u.$$events=s),T&&X(i,null),N=d,c=t(i,u)||{},N=!0,T&&(F.nodes_end=y),r&&J()}),()=>{var f;for(var n of _){e.removeEventListener(n,g);var o=p.get(n);--o===0?(document.removeEventListener(n,g),p.delete(n)):p.set(n,o)}S.delete(l),k.delete(c),i!==a&&((f=i.parentNode)==null||f.removeChild(i))}});return k.set(c,h),c}let k=new WeakMap;function _t(t){const e=k.get(t);e&&e()}export{dt as a,N as b,st as c,it as d,ft as h,ut as i,rt as m,lt as n,ct as s,_t as u};
