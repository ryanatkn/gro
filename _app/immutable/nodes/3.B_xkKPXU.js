import{a as v,t as k,e as L,d as H}from"../chunks/disclose-version.DdFaN9Wl.js";import{t as K,c as t,s as p,r as s,at as x,f as C,p as R,a as U,w as i,V as G}from"../chunks/runtime.CZOltbzF.js";import{s as A}from"../chunks/render.CFKWPCru.js";import{t as N,S as B,m as W,h as X,g as Z,i as $,j as ee,k as ae,s as Y,l as te,n as se,p as re,P as ne,L as oe,b as le,c as ve}from"../chunks/package.B0iRiGkx.js";import{i as j}from"../chunks/props.DdwLaWPu.js";import{s as I}from"../chunks/snippet.BFvSGcGm.js";import{s as de,a as ie}from"../chunks/store.DNU0LK3d.js";import{b as ce}from"../chunks/entry.BjZv7a3a.js";import{p as pe}from"../chunks/stores.DxEbNmEs.js";var me=k('<ul><li><a rel="me" href="https://www.webdevladder.net/">webdevladder.net</a> - realworld webdev with TypeScript and Svelte, <a href="https://www.webdevladder.net/blog">blog</a> and YouTube channels <a rel="me" href="https://youtube.com/@webdevladder">@webdevladder</a> and <a rel="me" href="https://youtube.com/@webdevladder_vods">@webdevladder_vods</a><!></li> <li><a rel="me" href="https://www.ryanatkn.com/">ryanatkn.com</a> - my homepage<!></li> <li>GitHub as <a rel="me" href="https://github.com/ryanatkn">@ryanatkn</a> and Bluesky as <a href="https://bsky.app/profile/ryanatkn.com">@ryanatkn.com</a></li> <li>Mastodon as <a rel="me" href="https://fosstodon.org/@ryanatkn">@ryanatkn@fosstodon.org</a>, <a rel="me" href="https://fosstodon.org/@webdevladder">@webdevladder@fosstodon.org</a> and <a rel="me" href="https://hci.social/@ryanatkn">@ryanatkn@hci.social</a></li> <li>@webdevladder on <a rel="me" href="https://www.reddit.com/user/webdevladder/">Reddit</a> and <a href="https://news.ycombinator.com/user?id=webdevladder">Hacker News</a></li> <li>support me at <a href="https://www.ryanatkn.com/funding">ryanatkn.com/funding</a></li></ul>');function _e(m,e){var a=me(),r=t(a),n=t(r),d=p(n,7);{var h=c=>{var w=L(", you are here");v(c,w)};j(d,c=>{e.selected==="webdevladder.net"&&c(h)})}s(r);var _=p(r,2),f=t(_),o=p(f,2);{var l=c=>{var w=L(", you are here");v(c,w)};j(o,c=>{e.selected==="ryanatkn.com"&&c(l)})}s(_),x(8),s(a),K(()=>{N(n,"selected",e.selected==="webdevladder.net"),N(f,"selected",e.selected==="ryanatkn.com")}),v(m,a)}var he=k('<a class="project_link svelte-1bpnvy9" title="Moss - CSS framework" href="https://moss.ryanatkn.com/"><!><span class="name svelte-1bpnvy9">Moss</span></a> <a class="project_link svelte-1bpnvy9" title="Fuz - Svelte UI library" href="https://www.fuz.dev/"><!><span class="name svelte-1bpnvy9">Fuz</span></a> <a class="project_link svelte-1bpnvy9" title="Gro - task runner and toolkit extending SvelteKit" href="https://gro.ryanatkn.com/"><!><span class="name svelte-1bpnvy9">Gro</span></a> <a class="project_link svelte-1bpnvy9" title="fuz_template - a static web app and Node library template with TypeScript, Svelte, SvelteKit, Vite, esbuild, Fuz, and Gro" href="https://template.fuz.dev/"><!><span class="name svelte-1bpnvy9">fuz_template</span></a>',1);function fe(m){const e="var(--icon_size_lg)";var a=he(),r=C(a),n=t(r);B(n,{data:W,size:e}),x(),s(r);var d=p(r,2),h=t(d);B(h,{data:X,size:e}),x(),s(d);var _=p(d,2),f=t(_);B(f,{data:Z,size:e}),x(),s(_);var o=p(_,2),l=t(o);B(l,{data:$,size:e}),x(),s(o),v(m,a)}var ue=k('<h2 class="mt_0 mb_lg">Links</h2>'),be=k('<section class="panel p_lg"><!> <!> <div class="box row"><!></div></section>');function ge(m,e){U(e,!0);var a=be(),r=t(a);{var n=o=>{var l=H(),c=C(l);I(c,()=>e.children),v(o,l)},d=o=>{var l=ue();v(o,l)};j(r,o=>{e.children?o(n):o(d,!1)})}var h=p(r,2);_e(h,{});var _=p(h,2),f=t(_);fe(f),s(_),s(a),v(m,a),R()}const ye=m=>m.split("/").filter(e=>e&&e!=="."&&e!==".."),ke=m=>{const e=[],a=ye(m);a.length&&e.push({type:"separator",path:"/"});let r="";for(let n=0;n<a.length;n++){const d=a[n];r+="/"+d,e.push({type:"piece",name:d,path:r}),n!==a.length-1&&e.push({type:"separator",path:r})}return e};var we=k('<a class="svelte-c9k2g"> </a>'),xe=k('<span class="separator svelte-c9k2g"><!></span>'),ze=k('<div class="breadcrumb svelte-c9k2g"><a class="svelte-c9k2g"><!></a><!></div>');function q(m,e){U(e,!0);const a=de(),r=()=>ie(pe,"$page",a),n=G(()=>e.base_path??ce),d=G(()=>e.path??se(r().url.pathname,i(n))),h=G(()=>e.selected_path===null?null:e.selected_path??i(d)),_=G(()=>ke(i(d))),f=G(()=>te(i(n),"/"));var o=ze(),l=t(o),c=t(l);{var w=b=>{var u=H(),y=C(u);I(y,()=>e.children),v(b,u)},M=b=>{var u=L("•");v(b,u)};j(c,b=>{e.children?b(w):b(M,!1)})}s(l);var P=p(l);ee(P,17,()=>i(_),ae,(b,u)=>{var y=H(),V=C(y);{var F=z=>{var g=we(),D=t(g,!0);s(g),K(()=>{Y(g,"href",i(n)+i(u).path),N(g,"selected",i(u).path===i(h)),A(D,i(u).name)}),v(z,g)},E=z=>{var g=xe(),D=t(g);{var J=S=>{var T=H(),Q=C(T);I(Q,()=>e.separator),v(S,T)},O=S=>{var T=L("/");v(S,T)};j(D,S=>{e.separator?S(J):S(O,!1)})}s(g),v(z,g)};j(V,z=>{i(u).type==="piece"?z(F):z(E,!1)})}v(b,y)}),s(o),K(()=>{Y(l,"href",i(f)),N(l,"selected",i(f)===i(n)+i(h))}),v(m,o),R()}var Se=k('<main class="width_md svelte-1pyh03k"><section class="mt_xl3 svelte-1pyh03k"><header class="box"><h1 class="svelte-1pyh03k"> </h1></header> <!></section> <!> <section class="box w_100 mb_lg svelte-1pyh03k"><div class="panel p_md width_md"><!></div></section> <section class="box svelte-1pyh03k"><nav class="mb_lg"><!></nav> <!></section></main>');function He(m,e){U(e,!0);const a=re(ve,le);var r=Se(),n=t(r),d=t(n),h=t(d),_=t(h,!0);s(h),s(d);var f=p(d,2);q(f,{children:(y,V)=>{x();var F=L("🧶");v(y,F)},$$slots:{default:!0}}),s(n);var o=p(n,2);ge(o,{});var l=p(o,2),c=t(l),w=t(c);ne(w,{pkg:a}),s(c),s(l);var M=p(l,2),P=t(M),b=t(P);q(b,{children:(y,V)=>{x();var F=L("🧶");v(y,F)},$$slots:{default:!0}}),s(P);var u=p(P,2);oe(u,{pkg:a}),s(M),s(r),K(()=>A(_,a.repo_name)),v(m,r),R()}export{He as component};