import{e as o,C as f,t as c,f as i,h as k,s as t,D as Y,E as $}from"../chunks/disclose-version.CH8sjwdA.js";import{p as R,t as H,d as U,g as s,l as S,b as aa,s as ea}from"../chunks/runtime.DT7e6tCC.js";import{s as C,d as ta}from"../chunks/render.vTiSLLbq.js";import{i as h,p as ra}from"../chunks/props.C3PAceBx.js";import{s as q,a as p,f as oa,t as sa,e as va,b as la,c as Z,p as _a,d as N,L as ia,g as na,h as O,P as da,i as Q}from"../chunks/package.w0RVPHrs.js";import{b as ha}from"../chunks/entry.BPguG-kz.js";import{s as E}from"../chunks/snippet.rLwicZip.js";import{s as ga,a as ca,p as ma}from"../chunks/stores.rlWqzBo8.js";var ua=c('<div class="repo_name svelte-1widkfd"> </div>'),Ha=c("<img>"),fa=c("<blockquote> </blockquote>"),ka=c('<p class="text_align_center"> <!></p>'),Va=c('<div class="homepage_url svelte-1widkfd"><a class="chip svelte-1widkfd"> </a></div>'),pa=c('<a class="chip svelte-1widkfd">repo</a>'),ba=c('<a class="chip svelte-1widkfd" title="version"> </a>'),wa=c('<a class="chip svelte-1widkfd">npm</a>'),xa=c('<blockquote class="npm_url svelte-1widkfd"> </blockquote>'),ya=c('<div class="package_summary svelte-1widkfd"><header class="box svelte-1widkfd"><!> <!></header> <!> <!> <!> <!> <div class="links svelte-1widkfd"><!> <!> <!></div> <!></div>');function za(x,a){R(a,!0);const L=ga(),y=()=>ca(ma,"$page",L),G=S(()=>a.pkg),b=S(()=>{let{package_json:v}=s(G);return[v]}),n=S(()=>s(b)[0]),w=S(()=>a.pkg.homepage_url?va(a.pkg.homepage_url,"/")+(a.pkg.package_json.logo?la(a.pkg.package_json.logo,"/"):"favicon.png"):void 0),P=a.pkg.package_json.logo_alt??`logo for ${a.pkg.repo_name}`;var z=ya(),M=i(z),V=i(M);h(V,()=>a.repo_name,v=>{var e=f(),g=k(e);E(g,()=>a.repo_name,()=>a.pkg.repo_name),o(v,e)},v=>{var e=ua(),g=i(e);H(()=>C(g,a.pkg.repo_name)),o(v,e)});var D=t(V,!0);D.nodeValue="  ";var F=t(D);h(F,()=>s(w),v=>{var e=f(),g=k(e);h(g,()=>a.logo,d=>{var r=f(),_=k(r);E(_,()=>a.logo,()=>s(w),()=>P),o(d,r)},d=>{var r=Ha();q(r,"alt",P),H(()=>{q(r,"src",s(w)),p(r,"width","var(--size, var(--icon_size_xl2))"),p(r,"height","var(--size, var(--icon_size_xl2))")}),o(d,r)}),o(v,e)});var B=t(t(M,!0));h(B,()=>s(n).motto,v=>{var e=f(),g=k(e);h(g,()=>a.motto,d=>{var r=f(),_=k(r);E(_,()=>a.motto,()=>s(n).motto,()=>s(n).glyph),o(d,r)},d=>{var r=fa(),_=i(r);H(()=>C(_,`${s(n).motto??""}
				${s(n).glyph??""}`)),o(d,r)}),o(v,e)});var j=t(t(B,!0));h(j,()=>s(n).description,v=>{var e=f(),g=k(e);h(g,()=>a.description,d=>{var r=f(),_=k(r);E(_,()=>a.description,()=>s(n).description,()=>s(n).glyph),o(d,r)},d=>{var r=ka(),_=i(r),I=t(_);h(I,()=>!s(n).motto,J=>{var K=Y(J);H(()=>C(K,s(n).glyph)),o(J,K)}),H(()=>C(_,`${s(n).description??""} `)),o(d,r)}),o(v,e)});var m=t(t(j,!0));h(m,()=>a.children,v=>{var e=f(),g=k(e);E(g,()=>a.children),o(v,e)});var l=t(t(m,!0));h(l,()=>a.pkg.homepage_url,v=>{var e=f(),g=k(e);h(g,()=>a.homepage_url,d=>{var r=f(),_=k(r);E(_,()=>a.homepage_url,()=>a.pkg.homepage_url),o(d,r)},d=>{var r=Va(),_=i(r),I=i(_);H(()=>C(I,oa(a.pkg.homepage_url))),H(()=>{q(_,"href",a.pkg.homepage_url),sa(_,"selected",a.pkg.homepage_url===y().url.href)}),o(d,r)}),o(v,e)});var u=t(t(l,!0)),T=i(u);h(T,()=>a.pkg.repo_url,v=>{var e=pa();H(()=>q(e,"href",a.pkg.repo_url)),o(v,e)});var A=t(t(T,!0));h(A,()=>a.pkg.changelog_url,v=>{var e=ba(),g=i(e);H(()=>{q(e,"href",a.pkg.changelog_url),C(g,s(n).version)}),o(v,e)});var W=t(t(A,!0));h(W,()=>a.pkg.npm_url,v=>{var e=wa();H(()=>q(e,"href",a.pkg.npm_url)),o(v,e)});var X=t(t(u,!0));h(X,()=>a.pkg.npm_url,v=>{var e=f(),g=k(e);h(g,()=>a.npm_url,d=>{var r=f(),_=k(r);E(_,()=>a.npm_url,()=>a.pkg.npm_url),o(d,r)},d=>{var r=xa(),_=i(r);H(()=>C(_,`npm i -D ${s(n).name??""}`)),o(d,r)}),o(v,e)}),o(x,z),U()}var Ma=$("<svg><path></path><path></path><path></path><path></path><path></path><path></path><path></path></svg>");function ja(x,a){const L=ra(a,"label",3,"a pixelated green oak acorn with a glint of sun"),y=S(()=>a.width??a.size),G=S(()=>a.height??a.size);var b=Ma();let n;var w=i(b);let P;var z=t(w);let M;var V=t(z);let D;var F=t(V);let B;var j=t(F);let m;var l=t(j);let u;var T=t(l);let A;H(()=>{n=Z(b,n,{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 100 100",...a.attrs,"aria-label":L(),class:a.classes},!1,""),p(b,"width",s(y)),p(b,"height",s(G)),P=Z(w,P,{...a.path_attrs,d:"m 24.035592,57.306905 v -14.5 h 16.329497 v 14.25 z"},!1,""),p(w,"fill","#6f974c"),M=Z(z,M,{...a.path_attrs,d:"M 43.75,93.75 H 37.5 V 87.5 H 31.25 V 81.25 H 25 V 75 H 18.75 V 62.5 H 12.5 V 50 H 6.25 V 43.75 H 4 v -21 L 22.75,16.5 h 40.5 l 0.5,61.5 -5,-0.75 -0.25,16.5 h -2.25 l -4,2.25 -2.24617,4 H 43.75 Z M 37.5,50 H 31.25 V 43.75 H 25 v 12.5 h 12.5 z"},!1,""),p(z,"fill","#5e853f"),D=Z(V,D,{...a.path_attrs,d:"m 50,93.75 h 6.25 V 75 H 62.5 V 50 H 56.25 V 37.5 H 50 V 31.25 H 43.75 V 25 H 31.25 V 18.75 H 25 V 25 H 12.5 v 6.25 H 6.25 v 12.5 H 0 v -25 H 6.25 V 12.5 h 12.5 V 6.25 H 37.5 V 0 h 25 v 6.25 h 18.75 v 6.25 h 12.5 v 6.25 H 100 v 25 H 93.75 V 50 H 87.5 V 62.5 H 81.25 V 75 H 75 v 6.25 H 68.75 V 87.5 H 62.5 v 6.25 H 56.25 V 100 H 50 Z"},!1,""),p(V,"fill","#6f492b"),B=Z(F,B,{...a.path_attrs,d:"m 50,93.75 h 6.25 V 75 H 62.5 V 50 H 56.25 V 37.5 H 50 V 31.25 H 43.75 V 25 H 31.25 V 18.75 H 25 V 25 H 12.5 v 6.25 H 6.25 v 12.5 H 0 V 25 H 12.5 V 18.75 H 25 V 12.5 H 43.75 V 6.25 h 12.5 V 12.5 H 75 v 6.25 H 87.5 V 25 H 100 V 43.75 H 93.75 V 50 H 87.5 V 62.5 H 81.25 V 75 H 75 v 6.25 H 68.75 V 87.5 H 62.5 v 6.25 H 56.25 V 100 H 50 Z"},!1,""),p(F,"fill","#3b730f"),m=Z(j,m,{...a.path_attrs,d:"M 87.5,37.5 H 81.25 V 31.25 H 68.75 V 25 H 62.5 V 18.75 H 43.75 25 V 25 H 12.5 v 6.25 H 6.25 v 12.5 H 0 V 25 H 12.5 V 18.75 H 25 V 12.5 H 43.75 V 6.25 h 12.5 V 12.5 H 75 v 6.25 H 87.5 V 25 H 100 V 43.75 H 93.75 V 50 H 87.5 Z"},!1,""),p(j,"fill","#473323"),u=Z(l,u,{...a.path_attrs,d:"M 87.5,37.5 H 81.25 V 31.25 H 68.75 V 25 H 62.5 v -6.25 h -25 V 12.5 H 50 V 6.25 h 6.25 v 6.25 h 12.5 v 6.25 h 12.5 V 25 h 12.5 v 6.25 H 100 v 12.5 H 93.75 V 50 H 87.5 Z"},!1,""),p(l,"fill","#2e6006"),A=Z(T,A,{...a.path_attrs,d:"M 93.75,31.25 H 87.5 V 25 h 6.25 v 6.25 H 100 v 12.5 H 93.75 Z M 75,18.75 h 6.25 V 25 H 75 Z M 37.5,12.5 H 50 V 6.25 h 6.25 v 6.25 h 12.5 v 6.25 H 53.125 37.5 Z"},!1,""),p(T,"fill","#34251a")}),o(x,b)}var Za=c('<div hidden>@ryanatkn@hci.social on <a rel="me" href="https://hci.social/@ryanatkn">Mastodon</a></div> <div hidden>@webdevladder@mastodon.social on <a rel="me" href="https://mastodon.social/@webdevladder">Mastodon</a></div>',1);function qa(x){var a=Za();o(x,a)}var La=(x,a)=>aa(a,!s(a)),Pa=c("🪜",1),Da=c("🔨",1),Fa=c('<div class="box w_100"><!></div>'),Ba=c('<div class="box"><!></div>'),Ca=c('<a class="mb_xs">about</a>'),Ea=c('<main class="box w_100 svelte-1mls9ls"><div class="box width_md"><section class="box svelte-1mls9ls"><h1>gro</h1> <a class="panel p_md box mb_xl3" title="source repo" href="https://github.com/ryanatkn/gro"><!></a> <aside>This website is a work in progress!<br> For now, docs are in <a href="https://github.com/ryanatkn/gro">the source repo</a></aside></section> <section class="panel mb_lg p_md w_100 relative svelte-1mls9ls"><button type="button" class="toggle icon_button svelte-1mls9ls"><!></button> <!></section> <section class="svelte-1mls9ls"><!></section></div></main>');function Oa(x,a){R(a,!0);const L=_a(N.homepage,N,na);let y=ea(!1);var G=Ea(),b=i(G),n=i(b),w=i(n),P=t(t(w,!0)),z=i(P);ja(z,{size:"var(--icon_size_lg)"});var M=t(t(n,!0)),V=i(M);V.__click=[La,y];var D=i(V);h(D,()=>s(y),m=>{var l=Pa();o(m,l)},m=>{var l=Da();o(m,l)});var F=t(t(V,!0));h(F,()=>s(y),m=>{var l=Fa();O(3,l,()=>Q);var u=i(l);da(u,{pkg:L}),o(m,l)},m=>{var l=Ba();O(3,l,()=>Q);var u=i(l);za(u,{pkg:L}),o(m,l)});var B=t(t(M,!0)),j=i(B);ia(j,{pkg:L,logo_header:l=>{var u=Ca();q(u,"href",`${ha??""}/about`),o(l,u)},children:(l,u)=>{qa(l)},$$slots:{default:!0}}),H(()=>q(V,"title",s(y)?"show package summary":"show package detail")),o(x,G),U()}ta(["click"]);export{Oa as component};
