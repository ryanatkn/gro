import{m as q,n as B,o as b,i as v,g as L,d as C,b as m,p as H,q as k,u as I,h as E,v as M,w as Y}from"./disclose-version.Co2svW8Z.js";import{d as P,c as V,A as W,B as A,C as $,D as F,F as G,m as j,p as z,h as J,k as K,G as Q}from"./runtime.YS-gNbUI.js";import{h as U,r as X}from"./svelte-head.C_5Oszvb.js";const N=new Set,T=new Set;function er(r,a,t,i){function n(e){if(i.capture||y.call(a,e),!e.cancelBubble)return t.call(this,e)}return r.startsWith("pointer")||r==="wheel"?W(()=>{a.addEventListener(r,n,i)}):a.addEventListener(r,n,i),n}function tr(r){for(var a=0;a<r.length;a++)N.add(r[a]);for(var t of T)t(r)}function y(r){var R;var a=this,t=a.ownerDocument,i=r.type,n=((R=r.composedPath)==null?void 0:R.call(r))||[],e=n[0]||r.target,c=0,l=r.__root;if(l){var f=n.indexOf(l);if(f!==-1&&(a===document||a===window)){r.__root=a;return}var u=n.indexOf(a);if(u===-1)return;f<=u&&(c=f)}if(e=n[c]||r.target,e!==a){P(r,"currentTarget",{configurable:!0,get(){return e||t}});try{for(var h,s=[];e!==null;){var d=e.parentNode||e.host||null;try{var o=e["__"+i];if(o!==void 0&&!e.disabled)if(V(o)){var[g,...p]=o;g.apply(e,[r,...p])}else o.call(e,r)}catch(w){h?s.push(w):h=w}if(r.cancelBubble||d===a||d===null)break;e=d}if(h){for(let w of s)queueMicrotask(()=>{throw w});throw h}}finally{r.__root=a,e=a}}}let O=!0;function nr(r,a){(r.__t??(r.__t=r.nodeValue))!==a&&(r.nodeValue=r.__t=a)}function Z(r,a){const t=a.anchor??a.target.appendChild(q());return A(()=>S(r,{...a,anchor:t}),!1)}function sr(r,a){a.intro=a.intro??!1;const t=a.target,i=E,n=m;try{return A(()=>{for(var e=t.firstChild;e&&(e.nodeType!==8||e.data!==B);)e=e.nextSibling;if(!e)throw b;v(!0),L(e),C();const c=S(r,{...a,anchor:e});if(m.nodeType!==8||m.data!==H)throw U(),b;return v(!1),c},!1)}catch(e){if(e===b)return a.recover===!1&&$(),k(),I(t),v(!1),Z(r,a);throw e}finally{v(i),L(n),X()}}const _=new Map;function S(r,{target:a,anchor:t,props:i={},events:n,context:e,intro:c=!0}){k();var l=new Set,f=s=>{for(var d=0;d<s.length;d++){var o=s[d];if(!l.has(o)){l.add(o);var g=Y.includes(o);a.addEventListener(o,y,{passive:g});var p=_.get(o);p===void 0?(document.addEventListener(o,y,{passive:g}),_.set(o,1)):_.set(o,p+1)}}};f(F(N)),T.add(f);var u=void 0,h=G(()=>(j(()=>{if(e){z({});var s=Q;s.c=e}n&&(i.$$events=n),E&&M(t,null),O=c,u=r(t,i)||{},O=!0,E&&(J.nodes.end=m),e&&K()}),()=>{for(var s of l){a.removeEventListener(s,y);var d=_.get(s);--d===0?(document.removeEventListener(s,y),_.delete(s)):_.set(s,d)}T.delete(f),D.delete(u)}));return D.set(u,h),u}let D=new WeakMap;function or(r){const a=D.get(r);a==null||a()}export{O as a,er as c,tr as d,sr as h,Z as m,nr as s,or as u};
