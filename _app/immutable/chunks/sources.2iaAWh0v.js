import{k as i,D as _,m as C,B as D,n as r,o as k,p as q,q as a,C as v,r as F,t as l,v as d,U as w,w as E,x as A,y as c,z as o,A as B,M as N,E as R,F as T}from"./runtime.C4xseUuN.js";function m(s,e){var n={f:0,v:s,reactions:null,equals:R,version:0};return n}function g(s){return I(m(s))}function x(s,e=!1){const n=m(s);return e||(n.equals=T),n}function I(s){return i!==null&&i.f&_&&(r===null?A([s]):r.push(s)),s}function L(s,e){return i!==null&&C()&&i.f&(_|D)&&(r===null||!r.includes(s))&&k(),Y(s,e)}function Y(s,e){return s.equals(e)||(s.v=e,s.version=q(),p(s,l),a!==null&&a.f&v&&!(a.f&F)&&(c!==null&&c.includes(s)?(d(a,l),E(a)):o===null?B([s]):o.push(s))),e}function p(s,e){var n=s.reactions;if(n!==null)for(var h=n.length,u=0;u<h;u++){var t=n[u],f=t.f;f&l||(d(t,e),f&(v|w)&&(f&_?p(t,N):E(t)))}}export{g as a,m as b,Y as i,x as m,L as s};