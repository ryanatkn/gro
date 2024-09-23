import{a as o,t as k,e as S,d as K}from"../chunks/disclose-version.nFzHpRgZ.js";import{t as M,s as d,c as a,r as t,ab as y,f as C,p as H,a as N,C as c,X as P}from"../chunks/runtime.D9vk1jrZ.js";import{s as B}from"../chunks/render.BOzddeUl.js";import{t as F,S as T,z as R,m as V,h as q,g as A,i as E,j as J,s as U,k as O,l as Q,n as W,p as $,P as ee,L as ae,b as te,c as se}from"../chunks/package.C4oU41gF.js";import{i as j}from"../chunks/props.BXgydXYx.js";import{s as D}from"../chunks/snippet.CFBYy2uk.js";import{s as re,a as ne,p as oe}from"../chunks/stores.DrMOeeqy.js";import{b as le}from"../chunks/entry.B5wflC4b.js";var de=k(`<ul><li>join <a rel="me" href="https://discord.gg/YU5tyeK72X">the Discord</a> community</li> <li><a rel="me" href="https://www.webdevladder.net/">webdevladder.net</a> - realworld webdev with TypeScript and Svelte, YouTube channels <a rel="me" href="https://youtube.com/@webdevladder">@webdevladder</a> and <a rel="me" href="https://youtube.com/@webdevladder_vods">@webdevladder_vods</a><!></li> <li><a rel="me" href="https://www.spiderspace.org/">spiderspace.org</a> - nontechnical design videos where we'll make a social website together with <a href="https://zzz.ryanatkn.com/">Zzz</a> when it's ready, YouTube channel <a rel="me" href="https://youtube.com/@spiderspace_8000">@spiderspace_8000</a><!></li> <li><a rel="me" href="https://www.ryanatkn.com/">ryanatkn.com</a> - my homepage<!></li> <li>GitHub - <a rel="me" href="https://github.com/ryanatkn">@ryanatkn</a> and <a rel="me" href="https://github.com/spiderspace">@spiderspace</a></li> <li>Mastodon as <a rel="me" href="https://mastodon.social/@webdevladder">@webdevladder@mastodon.social</a> and <a rel="me" href="https://hci.social/@ryanatkn">@ryanatkn@hci.social</a></li> <li>@webdevladder on <a rel="me" href="https://twitter.com/webdevladder">Twitter</a>, <a rel="me" href="https://www.reddit.com/user/webdevladder/">Reddit</a>, and <a href="https://news.ycombinator.com/user?id=webdevladder">Hacker News</a></li> <li>support me at <a href="https://www.ryanatkn.com/funding">ryanatkn.com/funding</a></li></ul>`);function ie(m,e){var s=de(),n=d(a(s),2),r=a(n),l=d(r,5);j(l,()=>e.selected==="webdevladder.net",b=>{var h=S(", you are here");o(b,h)}),t(n);var _=d(n,2),v=a(_),f=d(v,5);j(f,()=>e.selected==="spiderspace.org",b=>{var h=S(", you are here");o(b,h)}),t(_);var i=d(_,2),p=a(i),w=d(p,2);j(w,()=>e.selected==="ryanatkn.com",b=>{var h=S(", you are here");o(b,h)}),t(i),y(8),t(s),M(()=>{F(r,"selected",e.selected==="webdevladder.net"),F(v,"selected",e.selected==="spiderspace.org"),F(p,"selected",e.selected==="ryanatkn.com")}),o(m,s)}var ce=k('<a class="project_link svelte-1bpnvy9" title="Zzz - social web app framework" href="https://zzz.ryanatkn.com/"><!><span class="name svelte-1bpnvy9">Zzz</span></a> <a class="project_link svelte-1bpnvy9" title="Moss - CSS framework" href="https://moss.ryanatkn.com/"><!><span class="name svelte-1bpnvy9">Moss</span></a> <a class="project_link svelte-1bpnvy9" title="Fuz - Svelte UI library" href="https://www.fuz.dev/"><!><span class="name svelte-1bpnvy9">Fuz</span></a> <a class="project_link svelte-1bpnvy9" title="Gro - task runner and toolkit extending SvelteKit" href="https://gro.ryanatkn.com/"><!><span class="name svelte-1bpnvy9">Gro</span></a> <a class="project_link svelte-1bpnvy9" title="fuz_template - a static web app and Node library template with TypeScript, Svelte, SvelteKit, Vite, esbuild, Fuz, and Gro" href="https://template.fuz.dev/"><!><span class="name svelte-1bpnvy9">fuz_template</span></a>',1);function ve(m){const e="var(--icon_size_lg)";var s=ce(),n=C(s),r=a(n);T(r,{data:R,size:e}),y(),t(n);var l=d(n,2),_=a(l);T(_,{data:V,size:e}),y(),t(l);var v=d(l,2),f=a(v);T(f,{data:q,size:e}),y(),t(v);var i=d(v,2),p=a(i);T(p,{data:A,size:e}),y(),t(i);var w=d(i,2),b=a(w);T(b,{data:E,size:e}),y(),t(w),o(m,s)}var pe=k('<h2 class="mt_0 mb_lg">Links</h2>'),he=k('<section class="panel p_lg"><!> <!> <div class="box row"><!></div></section>');function me(m,e){H(e,!0);var s=he(),n=a(s);j(n,()=>e.children,v=>{var f=K(),i=C(f);D(i,()=>e.children),o(v,f)},v=>{var f=pe();o(v,f)});var r=d(n,2);ie(r,{});var l=d(r,2),_=a(l);ve(_),t(l),t(s),o(m,s),N()}const _e=m=>m.split("/").filter(e=>e&&e!=="."&&e!==".."),fe=m=>{const e=[],s=_e(m);s.length&&e.push({type:"separator",path:"/"});let n="";for(let r=0;r<s.length;r++){const l=s[r];n+="/"+l,e.push({type:"piece",name:l,path:n}),r!==s.length-1&&e.push({type:"separator",path:n})}return e};var ue=k('<a class="svelte-c9k2g"> </a>'),be=k('<span class="separator svelte-c9k2g"><!></span>'),ge=k('<div class="breadcrumb svelte-c9k2g"><a class="svelte-c9k2g"><!></a><!></div>');function X(m,e){H(e,!0);const s=re(),n=()=>ne(oe,"$page",s),r=P(()=>e.base_path??le),l=P(()=>e.path??W(n().url.pathname,c(r))),_=P(()=>e.selected_path===null?null:e.selected_path??c(l)),v=P(()=>fe(c(l))),f=P(()=>O(c(r),"/"));var i=ge(),p=a(i),w=a(p);j(w,()=>e.children,h=>{var u=K(),L=C(u);D(L,()=>e.children),o(h,u)},h=>{var u=S("•");o(h,u)}),t(p);var b=d(p);J(b,17,()=>c(v),Q,(h,u)=>{var L=K(),Y=C(L);j(Y,()=>c(u).type==="piece",z=>{var g=ue(),x=a(g);t(g),M(()=>{U(g,"href",c(r)+c(u).path),F(g,"selected",c(u).path===c(_)),B(x,c(u).name)}),o(z,g)},z=>{var g=be(),x=a(g);j(x,()=>e.separator,Z=>{var G=K(),I=C(G);D(I,()=>e.separator),o(Z,G)},Z=>{var G=S("/");o(Z,G)}),t(g),o(z,g)}),o(h,L)}),t(i),M(()=>{U(p,"href",c(f)),F(p,"selected",c(f)===c(r)+c(_))}),o(m,i),N()}var we=k('<main class="width_md svelte-1pyh03k"><section class="svelte-1pyh03k"><header class="box"><h1 class="svelte-1pyh03k"> </h1></header> <!></section> <!> <section class="box w_100 mb_lg svelte-1pyh03k"><div class="panel p_md width_md"><!></div></section> <section class="box svelte-1pyh03k"><nav class="mb_lg"><!></nav> <!></section></main>');function Te(m,e){H(e,!0);const s=$(se,te);var n=we(),r=a(n),l=a(r),_=a(l),v=a(_);t(_),t(l);var f=d(l,2);X(f,{children:(z,g)=>{y();var x=S("🧶");o(z,x)},$$slots:{default:!0}}),t(r);var i=d(r,2);me(i,{});var p=d(i,2),w=a(p),b=a(w);ee(b,{pkg:s}),t(w),t(p);var h=d(p,2),u=a(h),L=a(u);X(L,{children:(z,g)=>{y();var x=S("🧶");o(z,x)},$$slots:{default:!0}}),t(u);var Y=d(u,2);ae(Y,{pkg:s}),t(h),t(n),M(()=>B(v,s.repo_name)),o(m,n),N()}export{Te as component};
