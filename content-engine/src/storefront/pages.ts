/** Server-rendered pages. Every value that came from a person or a file goes through esc(). */
import type { BrandKit } from "./brand-kit.ts";
import type { Theme } from "../skills/render-themed/schema.ts";
import { OWN_HOST, OWN_LOOK, type Catalog } from "./catalog.ts";
import { HOST_FIELDS, HOST_RIGS, LOOK_CHOICES, MOODS, READY_RIG, hasHost, hasLook, hostFields, lookFields } from "./designer.ts";
import { INTAKE_FIELDS, ORDER_STATUSES, SECTIONS, intakeLabel, intakeMax, intakeRequired, type Intake, type Order, type SectionId } from "./store.ts";

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* A studio for cartoon hosts: soft lilac ground, deep indigo ink, one violet for actions and one stage-light
   yellow that sits behind whatever is being shown. Round lettering and round controls echo the characters.
   Three pages share one header: landing, demo, create. */
const CSS = `
@font-face{font-family:"Fredoka";font-weight:600;src:url(/assets/font/fredoka-600.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Space Grotesk";font-weight:700;src:url(/assets/font/grotesk-700.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Anton";font-weight:400;src:url(/assets/font/anton-400.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Montserrat";font-weight:800;src:url(/assets/font/montserrat-800.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Baloo 2";font-weight:700;src:url(/assets/font/baloo-700.woff2) format("woff2");font-display:swap}
:root{--bg:#f2f0f7;--surface:#fff;--ink:#1a1838;--muted:#63618a;--line:#dcd9ea;--soft:#e8e5f2;--accent:#5a31f4;--on-accent:#fff;--pop:#ffcf33;--on-pop:#1a1838;--ok:#0f7a5a;--warn:#b93a14;
--lift:0 24px 48px -24px rgba(26,24,56,.35);
--display:"Fredoka","Arial Rounded MT Bold","Helvetica Neue",Arial,sans-serif;--body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#110f20;--surface:#1a1730;--ink:#f1effa;--muted:#a3a0c4;--line:#2d2948;--soft:#231f3b;--accent:#a08bff;--on-accent:#110f20;--ok:#4cc79a;--warn:#f59e6b;--lift:0 24px 48px -24px rgba(0,0,0,.8);color-scheme:dark}}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 var(--body);-webkit-font-smoothing:antialiased}
h1,h2,h3,p,ul,ol,dl,dd,figure,fieldset{margin:0;padding:0;border:0;min-width:0}ul,ol{list-style:none}a{color:inherit}
h1,h2,h3,.display{font-family:var(--display);font-weight:600;line-height:1.04;text-wrap:balance}
h1{font-size:clamp(40px,6.4vw,74px);letter-spacing:-.015em}h2{font-size:clamp(28px,3.6vw,42px);letter-spacing:-.01em}h3{font-size:21px;line-height:1.2}
.eyebrow{font:600 15px/1.2 var(--body);color:var(--accent)}
.muted{color:var(--muted)}.lede{font-size:20px;line-height:1.5;color:var(--muted);max-width:50ch}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
main{display:flex;flex-direction:column;gap:112px;padding:64px 0 112px}
main.app{gap:44px;padding-top:44px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:8px}

.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px)}
.top .wrap{display:flex;align-items:center;gap:28px;height:68px}
.brand{display:flex;align-items:center;gap:10px;font:600 21px/1 var(--display);text-decoration:none}
.brand i{width:26px;height:26px;border-radius:50%;background:var(--pop);position:relative;flex:none}
.brand i::before,.brand i::after{content:"";position:absolute;top:9px;width:5px;height:7px;border-radius:50%;background:var(--on-pop)}.brand i::before{left:7px}.brand i::after{right:7px}
.top nav{display:flex;gap:24px;margin-left:auto;font-size:15.5px;font-weight:500}.top nav a{text-decoration:none;color:var(--muted)}.top nav a:hover,.top nav a[aria-current]{color:var(--ink)}
.brand,.btn{white-space:nowrap}.short{display:none}
@media(max-width:600px){.top nav a.hide{display:none}.top .wrap{gap:14px}.long{display:none}.short{display:inline}}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 16px/1 var(--body);padding:15px 24px;border-radius:99px;border:0;background:var(--ink);color:var(--bg);text-decoration:none;cursor:pointer;transition:transform .12s}
.btn:hover{transform:translateY(-2px)}.btn:active{transform:none}
.btn.accent{background:var(--accent);color:var(--on-accent)}.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}.btn.sm{padding:10px 16px;font-size:14.5px}
.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}

.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:72px;align-items:center}
.hero>div:first-child{display:flex;flex-direction:column;gap:24px;min-width:0}
.spot{position:relative;display:grid;place-items:center;padding:8px 0}
.spot::before{content:"";position:absolute;width:118%;aspect-ratio:1;border-radius:50%;background:var(--pop);bottom:-4%}
.phone{position:relative;border-radius:40px;padding:9px;background:#14122b;box-shadow:var(--lift);max-width:300px;width:100%}
.phone video,.phone img.shot{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:31px;background:#000}
.cast{display:flex;align-items:center;gap:14px;font-size:15.5px;color:var(--muted)}
.cast span{display:flex}.cast img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid var(--bg);margin-left:-12px;background:var(--surface)}.cast img:first-child{margin-left:0}
@media(max-width:820px){.hero{grid-template-columns:1fr;gap:56px}.spot{max-width:320px;margin:0 auto;width:100%}}

section{display:flex;flex-direction:column;gap:32px}.head{display:flex;flex-direction:column;gap:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.card{background:var(--surface);border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:10px;min-width:0}
.icon{width:46px;height:46px;border-radius:50%;background:var(--pop);display:grid;place-items:center;color:var(--on-pop);margin-bottom:6px}
.icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;counter-reset:n}
.flow li{counter-increment:n;display:flex;flex-direction:column;gap:8px;min-width:0}
.flow li::before{content:counter(n);font:600 22px/44px var(--display);width:44px;height:44px;border-radius:50%;background:var(--ink);color:var(--bg);text-align:center}
.shelf{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}.shelf .vis{border-radius:18px}@media(max-width:640px){.shelf{grid-template-columns:repeat(3,minmax(0,1fr))}}
.band{background:var(--accent);color:var(--on-accent);border-radius:32px;padding:clamp(32px,6vw,64px);display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between}
.band h2{max-width:18ch}.band .btn{background:var(--pop);color:var(--on-pop)}
footer{padding:28px 0;font-size:14.5px;color:var(--muted)}

/* demo */
.demo{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:64px;align-items:start}
.demo .stage{display:flex;flex-direction:column;gap:16px;position:sticky;top:92px}
@media(max-width:820px){.demo{grid-template-columns:1fr}.demo .stage{position:static;align-items:center}}
.seg{display:inline-flex;background:var(--soft);border-radius:99px;padding:5px;gap:2px;flex-wrap:wrap}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label{padding:9px 16px;border-radius:99px;font:600 15px/1 var(--body);color:var(--muted);cursor:pointer}
.seg label:has(input:checked){background:var(--surface);color:var(--ink)}
.seg label:has(input:focus-visible){outline:3px solid var(--accent);outline-offset:2px}
.tabs .panel{display:none;flex-direction:column;gap:22px}
.tabs:has(#t-identity:checked) .p-identity,.tabs:has(#t-host:checked) .p-host,.tabs:has(#t-colours:checked) .p-colours,.tabs:has(#t-story:checked) .p-story{display:flex}
.looks .shot{display:none}.looks:has(#l-collage:checked) .s-collage,.looks:has(#l-blueprint:checked) .s-blueprint{display:block}
.tabs,.looks{display:flex;flex-direction:column;gap:24px;min-width:0}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px 28px}.kv>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.kv dt,.label{font:600 14px/1.3 var(--body);color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chips li,.chip{background:var(--soft);border:0;border-radius:99px;padding:6px 14px;font-size:15px}
button.chip{font:inherit;font-size:15px;color:inherit;cursor:pointer}button.chip:hover{background:var(--accent);color:var(--on-accent)}
.swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px}
.sw{display:flex;flex-direction:column;gap:6px;font-size:14.5px}.sw i{display:block;height:72px;border-radius:18px;box-shadow:inset 0 0 0 1px var(--line)}.sw code{font:500 13px/1 var(--body);color:var(--muted)}
.beats{counter-reset:b;display:flex;flex-direction:column}.beats li{counter-increment:b;display:grid;grid-template-columns:34px minmax(0,110px) minmax(0,1fr);gap:4px 14px;padding:14px 0;border-top:1px solid var(--line);align-items:baseline}
.beats li::before{content:counter(b);font:600 17px/1 var(--display);color:var(--accent)}.beats b{text-transform:capitalize}
@media(max-width:560px){.beats li{grid-template-columns:28px minmax(0,1fr)}.beats span{grid-column:2}}
.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:520px}.frames img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:16px;display:block}
.quote{font:600 28px/1.15 var(--display)}
.list li{padding-left:22px;position:relative}.list li+li{margin-top:6px}.list li::before{content:"";position:absolute;left:2px;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--ok)}.list.no li::before{background:var(--warn)}

/* create */
.create{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,300px);gap:56px;align-items:start}
@media(max-width:900px){.create{grid-template-columns:1fr;gap:32px}.create .preview{position:static;order:-1;max-width:240px;margin:0 auto}}
form.wizard{background:var(--surface);border-radius:28px;padding:clamp(22px,4vw,40px);display:flex;flex-direction:column;gap:28px}
.progress{display:none;flex-direction:column;gap:10px}form.js .progress{display:flex}
.bar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden}.bar i{display:block;height:100%;width:25%;background:var(--accent);border-radius:99px;transition:width .25s}
.step{display:flex;flex-direction:column;gap:22px}.step legend{font:600 30px/1.1 var(--display);padding:0;margin-bottom:6px}
label.f{display:flex;flex-direction:column;gap:6px;font-weight:600;min-width:0}label.f small{font-weight:400;font-size:14.5px;color:var(--muted)}
input[type=text],input[type=email],textarea,select{font:400 16.5px/1.4 var(--body);color:var(--ink);background:var(--bg);border:1.5px solid transparent;border-radius:14px;padding:12px 14px;width:100%}
input:focus,textarea:focus,select:focus{outline:0;border-color:var(--accent);background:var(--surface)}
textarea{min-height:92px;resize:vertical}.error{color:var(--warn);font-weight:600;font-size:15px}
.pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:10px}
.pick label{position:relative;display:flex;flex-direction:column;gap:6px;border-radius:16px;padding:6px 6px 9px;cursor:pointer;font-weight:600;font-size:13.5px;line-height:1.2;text-align:center;background:var(--bg)}
.pick input{position:absolute;opacity:0}.pick label:has(input:checked){box-shadow:0 0 0 3px var(--accent)}
.pick label:has(input:focus-visible){outline:3px solid var(--accent);outline-offset:3px}
.vis{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:11px;display:block}.hosts .vis,.cast .vis{aspect-ratio:1}.vis.blank{background:var(--soft);display:grid;place-items:center;font:600 30px/1 var(--display);color:var(--muted)}
.designer{display:flex;flex-direction:column;gap:18px;background:var(--bg);border-radius:20px;padding:20px}
.designer:disabled{display:none}
.designer h3{font-size:19px}
.knobs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.knob{display:flex;flex-direction:column;gap:6px;font:600 14px/1.3 var(--body);color:var(--muted);min-width:0}
.knob select{background:var(--surface);padding:10px 12px;font-size:15.5px}
.inks{display:flex;flex-wrap:wrap;gap:14px}
.ink{display:flex;flex-direction:column;align-items:center;gap:6px;font:600 13px/1.2 var(--body);color:var(--muted);width:64px;text-align:center}
.ink input{appearance:none;-webkit-appearance:none;width:48px;height:48px;border:0;border-radius:50%;padding:0;background:none;cursor:pointer;box-shadow:0 0 0 3px var(--surface),0 0 0 4.5px var(--line)}
.ink input::-webkit-color-swatch-wrapper{padding:0}.ink input::-webkit-color-swatch{border:0;border-radius:50%}.ink input::-moz-color-swatch{border:0;border-radius:50%}
details.more summary{cursor:pointer;font:600 14.5px/1.3 var(--body);color:var(--accent)}details.more[open] summary{margin-bottom:14px}
.nav{display:flex;gap:12px;align-items:center}.nav .sp{margin-left:auto}
.preview{position:sticky;top:92px;display:flex;flex-direction:column;gap:14px;align-items:center}
.preview .phone{max-width:300px}
.preview p{font-size:14.5px;text-align:center;max-width:26ch}
.frame{position:relative;aspect-ratio:9/16;border-radius:31px;overflow:hidden;background:var(--paper);color:var(--text);container-type:inline-size;font-family:var(--bodyf),var(--body)}
.frame .bd,.frame .bd::before,.frame .bd::after{position:absolute;inset:0;content:""}
.frame[data-backdrop=grid] .bd{background-image:linear-gradient(color-mix(in srgb,var(--text) 15%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--text) 15%,transparent) 1px,transparent 1px);background-size:12.5cqw 12.5cqw}
.frame[data-backdrop=blobs] .bd{background:radial-gradient(circle at 80% 14%,color-mix(in srgb,var(--b) 60%,transparent),transparent 44%),radial-gradient(circle at 10% 82%,color-mix(in srgb,var(--c) 60%,transparent),transparent 42%)}
.frame[data-backdrop=sheets] .bd::before{inset:auto -8% -6% 46%;height:36%;background:var(--b);transform:rotate(-7deg)}
.frame[data-backdrop=sheets] .bd::after{inset:-4% 52% auto -10%;height:26%;background:var(--c);transform:rotate(6deg)}
.frame .plate{position:absolute;left:9%;top:15%;max-width:78%;font-family:var(--displayf),var(--display);font-weight:var(--displayw);font-size:10.5cqw;line-height:1.02;padding:2.5cqw 4cqw;overflow-wrap:anywhere}
.frame[data-casing=upper] .plate,.frame[data-casing=upper] .note b{text-transform:uppercase}
.frame[data-surface=torn] .plate{background:var(--a);color:var(--card);transform:rotate(-3deg);clip-path:polygon(0 6%,4% 0,97% 3%,100% 92%,95% 100%,2% 96%)}
.frame[data-surface=plain] .plate{background:var(--card);color:var(--ink);border-radius:5cqw;box-shadow:0 2cqw 5cqw -2cqw rgba(0,0,0,.3)}
.frame[data-surface=ruled] .plate{border:1.2cqw solid var(--text);outline:.6cqw solid var(--text);outline-offset:1.4cqw}
.frame[data-surface=glow] .plate{text-shadow:0 0 5cqw var(--accent);border-bottom:1.2cqw solid var(--accent)}
.frame .note{position:absolute;left:9%;right:16%;top:40%;padding:4cqw;font-size:4.6cqw;line-height:1.3;font-weight:700;display:flex;flex-direction:column;gap:1.5cqw;align-items:flex-start;background:var(--card);color:var(--ink)}
.frame .note b{font-size:3.6cqw;background:var(--a);color:var(--card);padding:.4cqw 2.4cqw}
.frame[data-surface=torn] .note{transform:rotate(1.5deg);clip-path:polygon(0 3%,98% 0,100% 96%,3% 100%)}
.frame[data-surface=plain] .note{border-radius:6cqw;box-shadow:0 2cqw 5cqw -2cqw rgba(0,0,0,.3)}.frame[data-surface=plain] .note b{border-radius:99px}
.frame[data-surface=ruled] .note{background:color-mix(in srgb,var(--text) 7%,transparent);color:var(--text);border:.8cqw solid var(--text)}
.frame[data-surface=glow] .note{background:color-mix(in srgb,var(--text) 5%,transparent);color:var(--text);border:.8cqw solid var(--accent);border-radius:4cqw;box-shadow:0 0 8cqw color-mix(in srgb,var(--accent) 55%,transparent)}
.frame[data-surface=ruled] .note b,.frame[data-surface=glow] .note b{background:none;color:var(--accent);padding:0}
.frame .art{position:absolute;right:12%;bottom:27%;width:34%;aspect-ratio:1;border-radius:50%;background:var(--b)}
.frame .art::before{content:"";position:absolute;inset:22%;background:var(--c);border-radius:18%;transform:rotate(12deg)}
.frame .art::after{content:"";position:absolute;inset:40%;background:var(--accent);border-radius:50%}
.frame[data-art=line] .art{background:none;border:1.2cqw solid var(--text)}.frame[data-art=line] .art::before{background:none;border:1.2cqw solid var(--b)}
.frame[data-art=cutout] .art{box-shadow:0 0 0 1.6cqw var(--card),1.5cqw 2.5cqw 0 1.6cqw rgba(0,0,0,.18)}
.frame .host{position:absolute;left:3%;bottom:24%;width:40%;aspect-ratio:1;object-fit:contain}
.frame[data-host=right] .host{left:auto;right:9%}.frame[data-host=right] .art{right:auto;left:10%}
.frame[data-host_size=small] .host{width:32%}.frame[data-host_size=large] .host{width:50%}
.frame[data-lettering=top] .note{top:31%}.frame[data-lettering=low] .note{top:47%}
.frame[data-pictures=stacked] .art{right:39%;left:auto;bottom:auto;top:26%;width:22%}.frame[data-pictures=stacked] .note{top:39.5%}
.frame .cap{position:absolute;left:8%;right:8%;bottom:11%;text-align:center;font:800 6.4cqw/1.15 var(--bodyf),var(--body);color:#fff;-webkit-text-stroke:1.6cqw #14122b;paint-order:stroke fill}
.frame .cap mark{background:none;color:var(--pop)}

/* workspace */
.ws{display:grid;grid-template-columns:230px minmax(0,1fr);gap:56px;align-items:start}
.side{position:sticky;top:92px;display:flex;flex-direction:column;gap:4px;font-size:15.5px}
.side a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:99px;text-decoration:none;color:var(--muted)}.side a:hover{background:var(--soft);color:var(--ink)}
.dot{width:10px;height:10px;border-radius:50%;border:2px solid var(--line);flex:none}.dot.ok{background:var(--ok);border-color:var(--ok)}.dot.warn{background:var(--warn);border-color:var(--warn)}
@media(max-width:860px){.ws{grid-template-columns:1fr;gap:24px}.side{position:static;flex-direction:row;overflow-x:auto;padding-bottom:6px}.side a{white-space:nowrap;background:var(--surface)}}
.ws .content{display:flex;flex-direction:column;gap:64px;min-width:0}
.track{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.track li{border-top:6px solid var(--line);border-radius:3px 3px 0 0;padding-top:12px;font-weight:600;font-size:15.5px;color:var(--muted);min-width:0}
.track li.done{border-color:var(--ink);color:var(--ink)}.track li.now{border-color:var(--accent);color:var(--ink)}.track small{display:block;font-weight:400;font-size:14px;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:6px;font:600 13.5px/1 var(--body);padding:7px 12px;border-radius:99px;background:var(--soft);color:var(--muted)}
.pill.ok{background:color-mix(in srgb,var(--ok) 16%,transparent);color:var(--ok)}.pill.warn{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}
.sample{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:36px;align-items:center}.sample>div:last-child{display:flex;flex-direction:column;gap:14px;min-width:0;align-items:flex-start}
@media(max-width:600px){.sample{grid-template-columns:1fr}}
form.decide{background:var(--surface);border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:14px}
.row{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}
.notice{background:var(--surface);border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.yours{display:flex;flex-wrap:wrap;gap:20px;align-items:center}.yours .vis{width:96px}.yours img.vis{aspect-ratio:1;object-fit:contain;background:var(--bg)}

/* orders */
.order{background:var(--surface);border-radius:24px;padding:24px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px 32px}
.order>div{display:flex;flex-direction:column;gap:10px;min-width:0}@media(max-width:760px){.order{grid-template-columns:1fr}}
.order select{flex:1;min-width:140px;padding:9px 12px}
code.link,pre.json{font:500 12.5px/1.5 ui-monospace,Menlo,monospace;word-break:break-all;user-select:all;background:var(--soft);padding:10px 12px;border-radius:12px;margin:0;white-space:pre-wrap}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn,.bar i{transition:none}}
`;

type Page = "home" | "demo" | "create" | "app";

/** Changes on every server start, so browsers never keep running an older copy of the script. */
const ASSET_VERSION = Date.now().toString(36);

function layout(product: string, title: string, page: Page, body: string, script = false): string {
  const link = (href: string, label: string, key: Page, cls = "") => `<a href="${href}"${cls ? ` class="${cls}"` : ""}${page === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const nav = page === "app" ? "" : `<nav>${link("/#how", "How it works", "home", "hide")}${link("/demo", "Demo", "demo")}</nav><a class="btn sm" href="/create" aria-label="Design your channel"><span class="long">Design your channel</span><span class="short">Design</span></a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><i></i>${esc(product)}</a>${nav}</div></header>
<div class="wrap"><main${page === "app" ? ' class="app"' : ""}>${body}</main></div>
${page === "app" ? "" : `<footer><div class="wrap">${esc(product)}. Videos, voices and pictures are AI-generated and labelled where platforms require it.</div></footer>`}
${script ? `<script src="/assets/app.js?v=${ASSET_VERSION}" defer></script>` : ""}</body></html>`;
}

const ICONS = {
  kit: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/></svg>`,
  host: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>`,
  video: `<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/></svg>`,
};

export function landingPage(product: string, catalog: Catalog): string {
  const cast = catalog.hosts.slice(0, 7).map((h) => `<img src="/assets/host/${h.id}.jpg" alt="" loading="lazy">`).join("");
  const shelf = [...catalog.looks.slice(0, 6).map((l) => lookSwatch(l.theme)), ...catalog.hosts.slice(0, 6).map((h) => `<img class="vis" src="/assets/host/${h.id}.jpg" alt="" loading="lazy">`)].join("");
  return layout(
    product,
    `${product}: faceless channels, designed by you`,
    "home",
    `<section class="hero">
<div><h1>Design a channel that looks like nobody else's.</h1>
<p class="lede">Build your own host and your own look, colour by colour. Then get finished short videos made in exactly that identity.</p>
<div class="actions"><a class="btn accent" href="/create">Design your channel</a><a class="btn ghost" href="/demo">See a finished one</a></div>
<p class="cast"><span>${cast}</span>Start from any of ${catalog.hosts.length} hosts and ${catalog.looks.length} looks, or from nothing.</p></div>
<div class="spot"><div class="phone"><video autoplay muted loop playsinline preload="metadata" poster="/assets/collage-1.jpg" src="/assets/sample.mp4" aria-label="A sample video made with ${esc(product)}"></video></div></div>
</section>

<section><div class="head"><h2>Nothing here is a template.</h2><p class="lede">Every one of these is only a starting point. Open it in the designer and change its shape, colours, lettering and mood until it is yours.</p></div>
<div class="shelf">${shelf}</div><div><a class="btn" href="/create">Open the designer</a></div></section>

<section><div class="head"><h2>What you end up with</h2></div>
<div class="cards">
<div class="card"><span class="icon">${ICONS.host}</span><h3>Your host</h3><p class="muted">A presenter you designed, with a personality, a catchphrase and a voice.</p></div>
<div class="card"><span class="icon">${ICONS.kit}</span><h3>Your look</h3><p class="muted">Your colours, lettering, shapes and movement, used in every video.</p></div>
<div class="card"><span class="icon">${ICONS.video}</span><h3>Finished videos</h3><p class="muted">Vertical, captioned, 20 to 35 seconds. Each one is a small story with a point.</p></div>
</div></section>

<section id="how"><div class="head"><h2>How it works</h2></div>
<ol class="flow">
<li><h3>Design it</h3><p class="muted">Describe the channel, then build the look and the host while you watch them change.</p></li>
<li><h3>Approve your brand kit</h3><p class="muted">Review each part in your private workspace and ask for changes in a note.</p></li>
<li><h3>Get your videos</h3><p class="muted">Every fact is checked against a source before a video is made. Watch and download.</p></li>
</ol></section>

<section class="band"><h2>See a real channel before you start.</h2><div class="actions"><a class="btn" href="/demo">Open the demo</a></div></section>`,
  );
}

const items = (list: string[], cls: string) => `<ul class="${cls}">${list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const swatches = (kit: BrandKit) => `<div class="swatches">${kit.colours.map((c) => `<div class="sw"><i style="background:${esc(c.hex)}"></i><b>${esc(c.name)}</b><code>${esc(c.hex.toUpperCase())}</code></div>`).join("")}</div>`;
const beats = (kit: BrandKit) => `<ol class="beats">${kit.series.beats.map((b) => `<li><b>${esc(b.id)}</b><span class="muted">${esc(b.purpose)}</span></li>`).join("")}</ol>`;
const hostFacts = (kit: BrandKit) =>
  `<dl class="kv"><div><dt>Looks like</dt><dd>${esc(kit.host.look)}</dd></div><div><dt>Personality</dt><dd>${items(kit.host.personality, "chips")}</dd></div><div><dt>Good at</dt><dd>${esc(kit.host.good_at.join("; "))}</dd></div><div><dt>Bad at</dt><dd>${esc(kit.host.bad_at.join("; "))}</dd></div><div><dt>Says, once per video</dt><dd class="quote">${esc(kit.host.catchphrases.join(" / "))}</dd></div><div><dt>Voice</dt><dd>${esc(kit.host.voice)}</dd></div></dl>`;
const identityFacts = (kit: BrandKit) =>
  `<dl class="kv"><div><dt>About</dt><dd>${esc(kit.niche)}</dd></div><div><dt>Who watches</dt><dd>${esc(kit.audience.who)} (${esc(kit.audience.age_range)})</dd></div><div><dt>Rhythm</dt><dd>${esc(kit.cadence)}</dd></div><div><dt>Made for</dt><dd>${esc(kit.platforms.join(", "))}</dd></div></dl>`;

/** The demonstration: a real channel's kit, explored with tabs. No account, nothing to fill in. */
export function demoPage(product: string, kit: BrandKit): string {
  const tab = (id: string, label: string, checked = false) => `<label><input type="radio" name="tab" id="t-${id}"${checked ? " checked" : ""}>${label}</label>`;
  const shots = (name: string) => `<div class="frames">${[1, 2, 3].map((n) => `<img src="/assets/${name}-${n}.jpg" alt="${name} look, frame ${n}">`).join("")}</div>`;
  return layout(
    product,
    `Demo — ${product}`,
    "demo",
    `<section><div class="head"><p class="eyebrow">Live demo</p><h1>${esc(kit.name)}</h1><p class="lede">A real channel made with ${esc(product)}. This is what you get: play the video, then open each part of its brand kit.</p></div></section>
<section class="demo">
<div class="stage"><div class="phone"><video controls playsinline preload="metadata" poster="/assets/collage-1.jpg" src="/assets/sample.mp4"></video></div><p class="muted" style="font-size:14.5px;text-align:center">The channel's first episode, 33 seconds.</p></div>
<div style="display:flex;flex-direction:column;gap:56px;min-width:0">
<div class="tabs"><div class="seg" role="group" aria-label="Brand kit">${tab("identity", "Identity", true)}${tab("host", "Host")}${tab("colours", "Colours")}${tab("story", "Story")}</div>
<div class="panel p-identity"><p class="display" style="font-size:24px;line-height:1.3">${esc(kit.promise)}</p>${identityFacts(kit)}<div class="kv"><div><p class="label">Always</p>${items(kit.styleNotes, "list")}</div><div><p class="label">Never</p>${items(kit.never, "list no")}</div></div></div>
<div class="panel p-host"><h2>${esc(kit.host.name)}</h2><p class="lede">${esc(kit.host.concept)}</p>${hostFacts(kit)}</div>
<div class="panel p-colours"><h2>Colours</h2>${swatches(kit)}<p class="muted">Lettering: ${esc(kit.font)}</p></div>
<div class="panel p-story"><h2>How every episode is told</h2><p class="lede">${esc(kit.series.format)}</p>${beats(kit)}</div>
</div>
<div class="looks"><div class="head"><p class="eyebrow">The look</p><h2>Same story, two looks.</h2></div>
<div class="seg" role="group" aria-label="Look"><label><input type="radio" name="look" id="l-collage" checked>Paper collage</label><label><input type="radio" name="look" id="l-blueprint">Blueprint</label></div>
<div class="shot s-collage">${shots("collage")}</div><div class="shot s-blueprint">${shots("blueprint")}</div>
<p class="muted">Both are drawn in motion. You pick one when you create your channel and can switch after you see yours.</p></div>
</div></section>
<section class="band"><h2>Now make it yours.</h2><div class="actions"><a class="btn" href="/create">Design your channel</a></div></section>`,
  );
}

function field(name: keyof Intake, values: Record<string, string>, errors: Partial<Record<keyof Intake, string>>, kind: "text" | "email" | "area", hint: string, placeholder: string): string {
  const value = esc(values[name] ?? "");
  const common = `id="${name}" name="${name}" maxlength="${intakeMax(name)}" placeholder="${esc(placeholder)}"${intakeRequired(name) ? " required" : ""}`;
  const control = kind === "area" ? `<textarea ${common}>${value}</textarea>` : `<input type="${kind}" ${common} value="${value}">`;
  const error = errors[name] ? `<span class="error">${esc(errors[name]!)}</span>` : "";
  return `<label class="f" for="${name}">${esc(intakeLabel(name))}<small>${esc(hint)}</small>${control}${error}</label>`;
}

/** A small picture of a look, drawn from its theme file: background, a headline plate, a note, the three colours. */
function lookSwatch(t: Theme): string {
  const [a, b, c] = t.colors;
  const back =
    t.backdrop === "grid"
      ? `<path d="M0 30H90M0 60H90M0 90H90M30 0V120M60 0V120" stroke="${t.text}" stroke-opacity=".18"/>`
      : t.backdrop === "blobs"
        ? `<circle cx="70" cy="22" r="30" fill="${b}" opacity=".45"/><circle cx="14" cy="104" r="28" fill="${c}" opacity=".45"/>`
        : t.backdrop === "sheets"
          ? `<rect x="-8" y="70" width="60" height="60" fill="${b}" transform="rotate(-9 20 100)"/><rect x="52" y="-12" width="52" height="46" fill="${c}" transform="rotate(8 78 10)"/>`
          : "";
  const outlined = t.surface === "glow" || t.surface === "ruled";
  const rx = t.surface === "plain" ? 6 : t.surface === "glow" ? 3 : 0;
  return `<svg class="vis" viewBox="0 0 90 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="90" height="120" fill="${t.paper}"/>${back}
<rect x="12" y="18" width="66" height="22" rx="${rx}" ${outlined ? `fill="none" stroke="${a}" stroke-width="2.5"` : `fill="${a}"`}${t.surface === "torn" ? ' transform="rotate(-4 45 30)"' : ""}/>
<rect x="10" y="54" width="70" height="38" rx="${rx}" fill="${t.card}"${outlined ? ` stroke="${t.accent}" stroke-width="1.5"` : ""}/>
<rect x="17" y="61" width="24" height="5" rx="2.5" fill="${t.accent}"/><rect x="17" y="72" width="54" height="4" rx="2" fill="${t.ink}"/><rect x="17" y="81" width="38" height="4" rx="2" fill="${t.ink}"/>
<circle cx="20" cy="106" r="5" fill="${a}"/><circle cx="34" cy="106" r="5" fill="${b}"/><circle cx="48" cy="106" r="5" fill="${c}"/></svg>`;
}

const FEELS = ["playful", "calm", "curious", "dramatic", "funny", "honest"];
/** The lettering faces the site can show, by the theme's name for them: family and the weight it is drawn in. */
const FACES: Record<string, [string, number]> = { anton: ["Anton", 400], montserrat: ["Montserrat", 800], "space-grotesk": ["Space Grotesk", 700], fredoka: ["Fredoka", 600], "baloo-2": ["Baloo 2", 700] };
const HEX = /^#[0-9a-f]{6}$/i;
/** Where the designer starts when there is nothing ready-made to start from. */
const BLANK_LOOK: Fields = { l_paper: "#f2f0f7", l_card: "#ffffff", l_ink: "#1a1838", l_text: "#1a1838", l_a: "#5a31f4", l_b: "#ffcf33", l_c: "#ff7a59", l_accent: "#5a31f4", l_display: "fredoka", l_body: "space-grotesk", l_casing: "normal", l_surface: "plain", l_backdrop: "blobs", l_texture: "none", l_motion: "snappy", l_art: "flat", l_host: "left", l_host_size: "medium", l_lettering: "middle", l_pictures: "beside" };
const BLANK_HOST: Fields = { h_rig: "flat-2d", h_shape: "blob", h_extra: "none", h_hair: "", h_eyes: "round", h_main: "#5a31f4", h_second: "#1a1838", h_accent: "#ffcf33", h_mood: "cheerful" };
type Fields = Record<string, string>;

const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

export function hostPreviewUrl(f: Fields): string {
  return `/preview/host.svg?${new URLSearchParams(HOST_FIELDS.map((k) => [k, f[k] ?? ""])).toString()}`;
}

/** The look's settings as CSS variables for the phone preview. Only checked colours and known faces get through. */
function frameStyle(f: Fields): string {
  const vars = ([["paper", "l_paper"], ["card", "l_card"], ["ink", "l_ink"], ["text", "l_text"], ["a", "l_a"], ["b", "l_b"], ["c", "l_c"], ["accent", "l_accent"]] as const).filter(([, k]) => HEX.test(f[k] ?? "")).map(([v, k]) => `--${v}:${f[k]}`);
  const display = FACES[(f.l_display ?? "").split(",")[0]];
  const body = FACES[f.l_body ?? ""];
  if (display) vars.push(`--displayf:'${display[0]}'`, `--displayw:${display[1]}`);
  if (body) vars.push(`--bodyf:'${body[0]}'`);
  return vars.join(";");
}

function knob(name: string, label: string, options: readonly string[], value: string, text: (o: string) => string = words): string {
  return `<label class="knob"${options.length ? "" : " hidden"}>${esc(label)}<select name="${name}">${options.map((o) => `<option value="${esc(o)}"${o === value ? " selected" : ""}>${esc(text(o))}</option>`).join("")}</select></label>`;
}

const ink = (name: string, label: string, value: string, slot = "") => `<label class="ink"><input type="color" name="${name}" value="${HEX.test(value) ? esc(value) : "#888888"}"><span${slot ? ` data-colour="${slot}"` : ""}>${esc(label)}</span></label>`;

/** The real creation: four short steps. The phone on the right is the customer's own host standing in their own look. */
export function createPage(product: string, catalog: Catalog, values: Fields = {}, errors: Partial<Record<keyof Intake, string>> = {}): string {
  const look = values.look === OWN_LOOK || catalog.looks.some((l) => l.name === values.look) ? values.look : (catalog.looks[0]?.name ?? OWN_LOOK);
  const host = values.avatar === OWN_HOST || catalog.hosts.some((h) => h.name === values.avatar) ? values.avatar : (catalog.hosts[0]?.name ?? OWN_HOST);
  const startLook = catalog.looks.find((l) => l.name === look);
  const startHost = catalog.hosts.find((h) => h.name === host);
  const lf = hasLook(values) ? values : startLook ? lookFields(startLook.theme) : BLANK_LOOK;
  const hf = hasHost(values) ? values : startHost ? hostFields(startHost.model) : BLANK_HOST;
  const rig = HOST_RIGS[hf.h_rig];
  const any = Object.keys(errors).length ? `<p class="error" role="alert">Some answers need fixing. Nothing was sent yet.</p>` : "";
  const start = (field: "look" | "avatar", value: string, chosen: string, vis: string, label: string, data = "") =>
    `<label>${vis}<input type="radio" name="${field}" value="${esc(value)}"${value === chosen ? " checked" : ""}${data}>${esc(label)}</label>`;
  const looks = [
    ...catalog.looks.map((l) => start("look", l.name, look, lookSwatch(l.theme), l.name, ` data-preset="${esc(JSON.stringify(lookFields(l.theme)))}"`)),
    start("look", OWN_LOOK, look, `<span class="vis blank">Aa</span>`, "In my own words"),
  ].join("");
  const hosts = [
    ...catalog.hosts.map((h) => start("avatar", h.name, host, `<img class="vis" src="/assets/host/${h.id}.jpg" alt="${esc(h.summary)}" loading="lazy">`, h.name, ` data-preset="${esc(JSON.stringify(hostFields(h.model)))}" data-pic="/assets/host/${h.id}.jpg"`)),
    start("avatar", OWN_HOST, host, `<span class="vis blank">?</span>`, "Design one for me"),
  ].join("");
  const displays = [...LOOK_CHOICES.l_display, ...(lf.l_display.includes(",") ? [lf.l_display] : [])];
  const face = (o: string) => (o.includes(",") ? "Mixed faces" : (FACES[o]?.[0] ?? words(o)));
  const hostSrc = host === OWN_HOST && !hasHost(values) ? "" : hf.h_rig === READY_RIG ? (startHost ? `/assets/host/${startHost.id}.jpg` : "") : hostPreviewUrl(hf);
  const rigs = { ...Object.fromEntries(Object.entries(HOST_RIGS).map(([k, v]) => [k, v])), [READY_RIG]: null };
  return layout(
    product,
    `Design your channel: ${product}`,
    "create",
    `<section><div class="head"><h1>Design your channel.</h1><p class="lede">Four short steps. The phone shows your host in your look as you build them.</p></div></section>
<section class="create">
<form class="wizard" method="post" action="/intake" data-wizard data-rigs="${esc(JSON.stringify(rigs))}" data-faces="${esc(JSON.stringify(FACES))}">
<div class="progress"><p class="label" data-count>Step 1 of 4</p><div class="bar"><i></i></div></div>${any}
<fieldset class="step"><legend>What is it about?</legend>
${field("idea", values, errors, "area", "One or two sentences. What is every video about?", "Surprising facts about the technology we use every day")}
${field("audience", values, errors, "text", "Who watches, and roughly how old they are.", "Curious teens and adults")}</fieldset>
<fieldset class="step"><legend>Build the look</legend>
${field("tone", values, errors, "text", "How it should feel, in a few words. Tap a suggestion or write your own.", "playful, honest")}
<div class="chips">${FEELS.map((f) => `<button type="button" class="chip" data-add="${f}">${f}</button>`).join("")}</div>
<div><p class="label" style="margin-bottom:10px">Start from one, then change anything</p><div class="pick" role="radiogroup" aria-label="Starting look">${looks}</div>${errors.look ? `<span class="error">${esc(errors.look)}</span>` : ""}</div>
<fieldset class="designer" data-designer="look" disabled><h3>Make it yours</h3>
<div class="inks">${ink("l_paper", "Background", lf.l_paper)}${ink("l_a", "Colour 1", lf.l_a)}${ink("l_b", "Colour 2", lf.l_b)}${ink("l_c", "Colour 3", lf.l_c)}${ink("l_accent", "Highlight", lf.l_accent)}</div>
<div class="knobs">${knob("l_display", "Headline lettering", displays, lf.l_display, face)}${knob("l_casing", "Letters", LOOK_CHOICES.l_casing, lf.l_casing, (o) => (o === "upper" ? "ALL CAPS" : "Sentence case"))}${knob("l_surface", "Cards and plates", LOOK_CHOICES.l_surface, lf.l_surface, (o) => ({ torn: "Torn paper", ruled: "Drafting lines", plain: "Soft cards", glow: "Glowing outlines" })[o] ?? words(o))}${knob("l_backdrop", "Behind everything", LOOK_CHOICES.l_backdrop, lf.l_backdrop, (o) => ({ sheets: "Paper sheets", grid: "A grid", blobs: "Soft colour", none: "Nothing" })[o] ?? words(o))}${knob("l_art", "Drawings", LOOK_CHOICES.l_art, lf.l_art, (o) => ({ cutout: "Paper cut-outs", line: "Line drawings", flat: "Flat shapes" })[o] ?? words(o))}${knob("l_motion", "Movement", LOOK_CHOICES.l_motion, lf.l_motion, (o) => ({ "stop-motion": "Stop motion", "draw-on": "Drawn on", snappy: "Quick and snappy" })[o] ?? words(o))}</div>
<h3>Arrange the scene</h3>
<div class="knobs">${knob("l_host", "Host stands", LOOK_CHOICES.l_host, lf.l_host, (o) => `On the ${o}`)}${knob("l_host_size", "Host size", LOOK_CHOICES.l_host_size, lf.l_host_size)}${knob("l_lettering", "Notes sit", LOOK_CHOICES.l_lettering, lf.l_lettering, (o) => ({ top: "High", middle: "In the middle", low: "Low, near the host" })[o] ?? words(o))}${knob("l_pictures", "Pictures go", LOOK_CHOICES.l_pictures, lf.l_pictures, (o) => (o === "beside" ? "Beside the host" : "Above the host"))}</div>
<details class="more"><summary>More settings</summary><div class="inks" style="margin-bottom:14px">${ink("l_card", "Cards", lf.l_card)}${ink("l_ink", "Text on cards", lf.l_ink)}${ink("l_text", "Text on background", lf.l_text)}</div>
<div class="knobs">${knob("l_body", "Small lettering", LOOK_CHOICES.l_body, lf.l_body, face)}${knob("l_texture", "Texture", LOOK_CHOICES.l_texture, lf.l_texture, (o) => (o === "grain" ? "Paper grain" : "Clean"))}</div></details></fieldset>
${field("look_note", values, errors, "area", "Optional. Anything the settings cannot say.", "Like a 1970s science textbook, a little faded")}</fieldset>
<fieldset class="step"><legend>Build the host</legend>
<div><p class="label" style="margin-bottom:10px">Start from one, then change anything</p><div class="pick hosts" role="radiogroup" aria-label="Starting host">${hosts}</div>${errors.avatar ? `<span class="error">${esc(errors.avatar)}</span>` : ""}</div>
<fieldset class="designer" data-designer="host" disabled><h3>Make it yours</h3>
<div class="knobs">${knob("h_rig", "Kind of host", [...Object.keys(HOST_RIGS), READY_RIG], hf.h_rig, (o) => HOST_RIGS[o]?.label ?? "3D robot, as it is")}${knob("h_shape", rig?.shapeLabel ?? "Shape", rig?.shape ?? [], hf.h_shape)}${knob("h_extra", "Wearing", rig?.extra ?? [], hf.h_extra)}${knob("h_hair", "Hair", rig?.hair ?? [], hf.h_hair)}${knob("h_eyes", "Eyes", rig?.eyes ?? [], hf.h_eyes)}${knob("h_mood", "Resting mood", MOODS, hf.h_mood)}</div>
<div class="inks" data-host-inks${rig ? "" : " hidden"}>${ink("h_main", rig?.colours[0] ?? "Main", hf.h_main, "0")}${ink("h_second", rig?.colours[1] ?? "Second", hf.h_second, "1")}${ink("h_accent", rig?.colours[2] ?? "Accent", hf.h_accent, "2")}</div>
<p class="muted" data-ready-note style="font-size:14.5px"${rig ? " hidden" : ""}>3D robots are used as they are. Say what to change in the notes below.</p></fieldset>
${field("host", values, errors, "area", "Optional. Its name, its personality, or anything the settings cannot say.", "Called Sprocket. Impatient, loves taking things apart")}
${field("avoid", values, errors, "area", "Optional. Subjects the channel must never cover.", "Politics, medical advice")}</fieldset>
<fieldset class="step"><legend>Where do we reach you?</legend>
${field("contact_name", values, errors, "text", "So we know who to talk to.", "Your name")}
${field("email", values, errors, "email", "Used only to contact you about this channel.", "you@example.com")}</fieldset>
<div class="nav"><button type="button" class="btn ghost" data-back hidden>Back</button><span class="sp"></span><button type="button" class="btn" data-next hidden>Continue</button><button type="submit" class="btn accent" data-submit>Create my workspace</button></div>
</form>
<aside class="preview" aria-label="Your channel so far"><div class="phone"><div class="frame" data-frame data-casing="${esc(lf.l_casing)}" data-surface="${esc(lf.l_surface)}" data-backdrop="${esc(lf.l_backdrop)}" data-art="${esc(lf.l_art)}" data-host="${esc(lf.l_host)}" data-host_size="${esc(lf.l_host_size)}" data-lettering="${esc(lf.l_lettering)}" data-pictures="${esc(lf.l_pictures)}" style="${frameStyle(lf)}">
<div class="bd"></div><div class="plate">Your headline</div><div class="note"><b>The hook</b><span data-out="idea" data-empty="What your channel is about shows up here.">What your channel is about shows up here.</span></div>
<div class="art"></div><img class="host" data-host-img alt="Your host"${hostSrc ? ` src="${esc(hostSrc)}"` : " hidden"}><div class="cap">every word <mark>lights up</mark></div></div></div>
<p class="muted">A sketch of your look and host. Nothing is sent until the last step.</p></aside>
</section>`,
    true,
  );
}

const STATUS_TEXT: Record<Order["status"], string> = {
  "awaiting-payment": "Waiting for payment",
  paid: "Paid — we are starting on your brand kit",
  "in-production": "In production",
  delivered: "Delivered",
};

function track(order: Order, hasKit: boolean): string {
  // The step the customer is on now: payment, then the brand kit (being made or under review), then done.
  const at = order.status === "awaiting-payment" ? 1 : order.status === "delivered" ? 4 : 2;
  const steps = [
    ["Brief", "Sent"],
    ["Payment", order.status === "awaiting-payment" ? "Waiting" : order.no_payment ? "Not needed for now" : "Received"],
    ["Brand kit", hasKit ? "Ready to review" : "Being made"],
    ["Videos", order.status === "delivered" ? "Delivered" : "After your approval"],
  ];
  return `<ol class="track">${steps.map(([name, note], i) => `<li class="${i < at ? "done" : i === at ? "now" : ""}">${esc(name)}<small>${esc(note)}</small></li>`).join("")}</ol>`;
}

function decisionForm(order: Order, id: SectionId): string {
  const d = order.decisions[id];
  const state = d ? `<span class="pill ${d.decision === "approve" ? "ok" : "warn"}">${d.decision === "approve" ? "Approved" : "Change requested"}</span>` : `<span class="pill">Not decided yet</span>`;
  return `<form method="post" action="/w/${esc(order.token)}/decision" class="decide"><input type="hidden" name="section" value="${id}"><div class="row"><h3>Your decision</h3>${state}</div>
<div class="seg"><label><input type="radio" name="decision" value="approve"${d?.decision === "approve" ? " checked" : ""} required>Approve</label><label><input type="radio" name="decision" value="change"${d?.decision === "change" ? " checked" : ""}>Ask for a change</label></div>
<label class="f" for="note-${id}">Note<small>Optional when approving. Say what to change if you are asking for one.</small><textarea id="note-${id}" name="note" maxlength="600">${esc(d?.note ?? "")}</textarea></label><div><button type="submit" class="btn sm">Save decision</button></div></form>`;
}

function kitSection(order: Order, id: SectionId, content: string): string {
  const label = SECTIONS.find((s) => s.id === id)!.label;
  return `<section id="${id}" style="scroll-margin-top:88px"><h2>${esc(label)}</h2>${content}${decisionForm(order, id)}</section>`;
}

function kitHtml(order: Order, kit: BrandKit): string {
  const base = `/w/${esc(order.token)}`;
  const latest = kit.episodes[kit.episodes.length - 1];
  const video = latest
    ? `<section><h2>Your first video</h2><div class="sample"><div class="phone"><video controls playsinline preload="metadata" src="${base}/video/${esc(latest.id)}"></video></div><div><h3>${esc(latest.title)}</h3><p class="muted">The finished video, exactly as it would be posted. Everything below is what it is made of.</p><a class="btn sm" href="${base}/video/${esc(latest.id)}?download=1">Download the video</a></div></div></section>`
    : `<section><h2>Your first video</h2><p class="muted">No finished video yet. It appears here as soon as the first one passes its checks.</p></section>`;
  const frames = latest && latest.frames.length ? `<div class="frames">${latest.frames.map((f) => `<img src="${base}/frame/${esc(latest.id)}/${esc(f)}" alt="A frame from the video">`).join("")}</div>` : "";
  const side = `<nav class="side" aria-label="Brand kit sections">${SECTIONS.map((s) => {
    const d = order.decisions[s.id];
    return `<a href="#${s.id}"><span class="dot ${d ? (d.decision === "approve" ? "ok" : "warn") : ""}"></span>${esc(s.label)}</a>`;
  }).join("")}</nav>`;
  return `<div class="ws">${side}<div class="content">
${video}
${kitSection(order, "name", `<p class="display" style="font-size:clamp(30px,5vw,46px)">${esc(kit.name)}</p><p class="lede">${esc(kit.promise)}</p>${identityFacts(kit)}`)}
${kitSection(order, "host", `<p class="lede"><b style="color:var(--ink)">${esc(kit.host.name)}.</b> ${esc(kit.host.concept)}</p>${hostFacts(kit)}`)}
${kitSection(order, "colours", `${swatches(kit)}<p class="muted">Lettering: ${esc(kit.font)}</p>`)}
${kitSection(order, "look", `<p>${esc(kit.series.visual_style)}</p>${frames}`)}
${kitSection(order, "format", `<p class="lede">${esc(kit.series.format)}</p>${beats(kit)}`)}
${kitSection(order, "tone", `<div class="kv"><div><p class="label">Feels</p>${items(kit.tone, "chips")}</div><div><p class="label">Always</p>${items(kit.styleNotes, "list")}</div><div><p class="label">Never</p>${items(kit.never, "list no")}</div></div>`)}
</div></div>`;
}

export function workspacePage(product: string, order: Order, kit: BrandKit | null, paymentUrl: string | null): string {
  const d = order.design;
  const yours = d && (d.theme || d.model) ? `<div class="yours">${d.theme ? lookSwatch(d.theme) : ""}${d.model && HOST_RIGS[d.model.rig] ? `<img class="vis" src="${esc(hostPreviewUrl(hostFields(d.model)))}" alt="Your host">` : ""}<p class="muted" style="max-width:36ch">The look and host you designed. Your brand kit is built from these.</p></div>` : "";
  const brief = `<section><h2>Your brief</h2>${yours}<dl class="kv notice" style="display:grid">${INTAKE_FIELDS.filter((f) => f !== "email" && order.intake[f]).map((f) => `<div><dt>${esc(intakeLabel(f))}</dt><dd>${esc(order.intake[f])}</dd></div>`).join("")}</dl></section>`;
  let body: string;
  if (order.status === "awaiting-payment") {
    body = paymentUrl
      ? `<section class="notice"><h2>One step left</h2><p class="muted">Work starts when payment arrives. Quote reference <b>${esc(order.id)}</b> if asked.</p><a class="btn accent" href="${esc(paymentUrl)}" rel="noopener">Pay securely</a></section>`
      : `<section class="notice"><h2>One step left</h2><p class="muted">Work starts when payment arrives. Online payment is not switched on yet, so we will contact you at the email you gave. Your reference is <b>${esc(order.id)}</b>.</p></section>`;
  } else if (!kit) {
    body = `<section class="notice"><h2>Your brand kit is being made</h2><p class="muted">It appears on this page, section by section, for you to approve. Nothing else is needed from you right now.</p></section>`;
  } else {
    body = kitHtml(order, kit);
  }
  return layout(
    product,
    `Your workspace — ${product}`,
    "app",
    `<section><div class="row"><p class="eyebrow">Order ${esc(order.id)}</p><span class="pill">${esc(STATUS_TEXT[order.status])}</span></div>
<h1>Hello, ${esc(order.intake.contact_name)}</h1>
${track(order, kit !== null)}
<p class="muted" style="font-size:14.5px;max-width:70ch">This page is private to you. Anyone with its link can open it, so keep the link like a password and bookmark it now — there is no login to get it back.</p></section>
${body}${brief}`,
  );
}

export function adminPage(product: string, orders: Order[], channels: string[], publicBase: string): string {
  const cards = orders
    .slice()
    .reverse()
    .map((o) => {
      const decisions = SECTIONS.map((s) => {
        const d = o.decisions[s.id];
        return d ? `<li><span class="pill ${d.decision === "approve" ? "ok" : "warn"}">${d.decision === "approve" ? "approved" : "change"}</span> ${esc(s.label)}${d.note ? ` — ${esc(d.note)}` : ""}</li>` : "";
      }).join("");
      return `<article class="order"><div><h3>${esc(o.id)} · ${esc(o.intake.contact_name)}</h3><p class="muted">${esc(o.intake.email)} · ${esc(o.created.slice(0, 10))}</p><p>${esc(o.intake.idea)}</p>
<p class="muted" style="font-size:14.5px">For: ${esc(o.intake.audience)} · Feel: ${esc(o.intake.tone)} · Look: ${esc(o.intake.look)}${o.intake.look_note ? ` (${esc(o.intake.look_note)})` : ""}${o.intake.avatar ? ` · Host: ${esc(o.intake.avatar)}` : ""}${o.intake.host ? ` · Host notes: ${esc(o.intake.host)}` : ""}${o.intake.avoid ? ` · Avoid: ${esc(o.intake.avoid)}` : ""}</p>
${decisions ? `<ul style="display:flex;flex-direction:column;gap:6px">${decisions}</ul>` : `<p class="muted">No decisions yet</p>`}</div>
<div><form method="post" action="/orders/${esc(o.id)}/status" class="row"><select name="status" aria-label="Status of ${esc(o.id)}">${ORDER_STATUSES.map((s) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select><button type="submit" class="btn sm">Set</button></form>
<form method="post" action="/orders/${esc(o.id)}/channel" class="row"><select name="channel" aria-label="Channel for ${esc(o.id)}"><option value="">(no channel)</option>${channels.map((c) => `<option${c === o.channel ? " selected" : ""}>${esc(c)}</option>`).join("")}</select><button type="submit" class="btn sm">Link</button></form>
${o.design && (o.design.theme || o.design.model) ? `<details><summary class="label">Design files</summary>${o.design.theme ? `<p class="label">theme.json</p><pre class="json">${esc(JSON.stringify(o.design.theme, null, 2))}</pre>` : ""}${o.design.model ? `<p class="label">model.json</p><pre class="json">${esc(JSON.stringify(o.design.model, null, 2))}</pre>` : ""}</details>` : ""}
<p class="label">Workspace link</p><code class="link">${esc(publicBase)}/w/${esc(o.token)}</code></div></article>`;
    })
    .join("");
  return layout(
    `${product} · Orders`,
    "Orders",
    "app",
    `<section><h1>Orders</h1><p class="muted">This page is served only to this computer. ${orders.length} order${orders.length === 1 ? "" : "s"}.</p></section>
<section>${cards || `<p class="muted">No orders yet. They appear here when someone finishes the creation steps.</p>`}</section>`,
  );
}

export function messagePage(product: string, title: string, text: string): string {
  return layout(product, title, "home", `<section><h1>${esc(title)}</h1><p class="lede">${esc(text)}</p><div><a class="btn" href="/">Back to the start</a></div></section>`);
}
