import{d as F,h as N,k as $,E as w,e as G,B as H,C as Z,f as z,s as L,D as h,m as D,F as U,U as J,i as K,G as Q,I as V,q,J as Y,K as S,L as y,M as W,N as X,P as j,O as k,Q as x,R as ee,a as B,S as re,T as ae,V as ne,W as se,X as ue}from"./DRN9uu3c.js";import{s as te,g as ie}from"./B_aD8gZ1.js";function _e(e,a,[n,r]=[0,0]){N&&n===0&&$();var u=e,t=null,i=null,b=J,T=n>0?w:0,f=!1;const m=(c,l=!0)=>{f=!0,o(l,c)},o=(c,l)=>{if(b===(b=c))return;let d=!1;if(N&&r!==-1){if(n===0){const _=u.data;_===G?r=0:_===H?r=1/0:(r=parseInt(_.substring(1)),r!==r&&(r=b?1/0:-1))}const g=r>n;!!b===g&&(u=Z(),z(u),L(!1),d=!0,r=-1)}b?(t?h(t):l&&(t=D(()=>l(u))),i&&U(i,()=>{i=null})):(i?h(i):l&&(i=D(()=>l(u,[n+1,r]))),t&&U(t,()=>{t=null})),d&&L(!0)};F(()=>{f=!1,a(m),f||o(null,null)},T),N&&(u=K)}let A=!1,p=Symbol();function ve(e,a,n){const r=n[a]??(n[a]={store:null,source:Y(void 0),unsubscribe:q});if(r.store!==e&&!(p in n))if(r.unsubscribe(),r.store=e??null,e==null)r.source.v=void 0,r.unsubscribe=q;else{var u=!0;r.unsubscribe=te(e,t=>{u?r.source.v=t:y(r.source,t)}),u=!1}return e&&p in n?ie(e):S(r.source)}function oe(){const e={};function a(){Q(()=>{for(var n in e)e[n].unsubscribe();V(e,p,{enumerable:!1,value:!0})})}return[e,a]}function fe(e){var a=A;try{return A=!1,[e(),A]}finally{A=a}}function M(e){var a;return((a=e.ctx)==null?void 0:a.d)??!1}function be(e,a,n,r){var O;var u=(n&se)!==0,t=!0,i=(n&re)!==0,b=(n&ue)!==0,T=!1,f;i?[f,T]=fe(()=>e[a]):f=e[a];var m=ae in e||ne in e,o=i&&(((O=W(e,a))==null?void 0:O.set)??(m&&a in e&&(s=>e[a]=s)))||void 0,c=r,l=!0,d=!1,g=()=>(d=!0,l&&(l=!1,b?c=B(r):c=r),c);f===void 0&&r!==void 0&&(o&&t&&X(),f=g(),o&&o(f));var _;if(_=()=>{var s=e[a];return s===void 0?g():(l=!0,d=!1,s)},(n&j)===0)return _;if(o){var C=e.$$legacy;return function(s,I){return arguments.length>0?((!I||C||T)&&o(I?_():s),s):_()}}var E=!1,P=Y(f),v=x(()=>{var s=_(),I=S(P);return E?(E=!1,I):P.v=s});return i&&S(v),u||(v.equals=k),function(s,I){if(arguments.length>0){const R=I?S(v):i?ee(s):s;if(!v.equals(R)){if(E=!0,y(P,R),d&&c!==void 0&&(c=R),M(v))return s;B(()=>S(v))}return s}return M(v)?v.v:S(v)}}export{ve as a,_e as i,be as p,oe as s};
