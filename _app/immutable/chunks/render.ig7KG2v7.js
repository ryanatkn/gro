import{m as S,n as q,o as v,i as m,g as B,d as C,b,p as H,q as O,u as I,h as E,v as M,w as Y}from"./disclose-version.Co2svW8Z.js";import{d as P,c as V,A as W,B as k,C as $,D as F,F as G,m as j,p as z,h as J,k as K,G as Q}from"./runtime.YS-gNbUI.js";import{h as U,r as X}from"./svelte-head.6oI-JhRD.js";const A=new Set,T=new Set;function er(r,a,n,i){function e(t){if(i.capture||_.call(a,t),!t.cancelBubble)return n.call(this,t)}return r.startsWith("pointer")||r==="wheel"?W(()=>{a.addEventListener(r,e,i)}):a.addEventListener(r,e,i),e}function tr(r){for(var a=0;a<r.length;a++)A.add(r[a]);for(var n of T)n(r)}function _(r){var R;var a=this,n=a.ownerDocument,i=r.type,e=((R=r.composedPath)==null?void 0:R.call(r))||[],t=e[0]||r.target,y=0,c=r.__root;if(c){var d=e.indexOf(c);if(d!==-1&&(a===document||a===window)){r.__root=a;return}var u=e.indexOf(a);if(u===-1)return;d<=u&&(y=d)}if(t=e[y]||r.target,t!==a){P(r,"currentTarget",{configurable:!0,get(){return t||n}});try{for(var l,s=[];t!==null;){var f=t.parentNode||t.host||null;try{var o=t["__"+i];if(o!==void 0&&!t.disabled)if(V(o)){var[g,...p]=o;g.apply(t,[r,...p])}else o.call(t,r)}catch(w){l?s.push(w):l=w}if(r.cancelBubble||f===a||f===null)break;t=f}if(l){for(let w of s)queueMicrotask(()=>{throw w});throw l}}finally{r.__root=a,t=a}}}let L=!0;function nr(r,a){(r.__t??(r.__t=r.nodeValue))!==a&&(r.nodeValue=r.__t=a)}function Z(r,a){const n=a.anchor??a.target.appendChild(S());return k(()=>N(r,{...a,anchor:n}),!1)}function sr(r,a){a.intro=a.intro??!1;const n=a.target,i=E;try{return k(()=>{for(var e=n.firstChild;e&&(e.nodeType!==8||e.data!==q);)e=e.nextSibling;if(!e)throw v;m(!0),B(e),C();const t=N(r,{...a,anchor:e});if(b.nodeType!==8||b.data!==H)throw U(),v;return m(!1),t},!1)}catch(e){if(e===v)return a.recover===!1&&$(),O(),I(n),m(!1),Z(r,a);throw e}finally{m(i),X()}}const h=new Map;function N(r,{target:a,anchor:n,props:i={},events:e,context:t,intro:y=!0}){O();var c=new Set,d=s=>{for(var f=0;f<s.length;f++){var o=s[f];if(!c.has(o)){c.add(o);var g=Y.includes(o);a.addEventListener(o,_,{passive:g});var p=h.get(o);p===void 0?(document.addEventListener(o,_,{passive:g}),h.set(o,1)):h.set(o,p+1)}}};d(F(A)),T.add(d);var u=void 0,l=G(()=>(j(()=>{if(t){z({});var s=Q;s.c=t}e&&(i.$$events=e),E&&M(n,null),L=y,u=r(n,i)||{},L=!0,E&&(J.nodes.end=b),t&&K()}),()=>{for(var s of c){a.removeEventListener(s,_);var f=h.get(s);--f===0?(document.removeEventListener(s,_),h.delete(s)):h.set(s,f)}T.delete(d),D.delete(u)}));return D.set(u,l),u}let D=new WeakMap;function or(r){const a=D.get(r);a==null||a()}export{L as a,er as c,tr as d,sr as h,Z as m,nr as s,or as u};
