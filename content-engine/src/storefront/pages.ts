/** Server-rendered pages. Every value that came from a person or a file goes through esc(). */
import type { Draft, User } from "./accounts.ts";
import type { BrandKit } from "./brand-kit.ts";
import type { Dashboard, StoryboardView } from "./builder.ts";
import type { CaptionSettings } from "../pipeline/storyboard.ts";
import type { Idea } from "../core/ideas.ts";
import { FRAME_PRESET_NAMES, FRAME_PRESETS, showsHost, type Frame, type Shot, type ThBeatVisual, type Theme } from "../skills/render-themed/schema.ts";
import { voiceTokens, type Script } from "../skills/write-script/schema.ts";
import { NO_HOST, OWN_HOST, OWN_LOOK, type Catalog } from "./catalog.ts";
import { HOST_FIELDS, HOST_RIGS, LOOK_CHOICES, MOODS, READY_RIG, hasHost, hasLook, hostFields, lookFields } from "./designer.ts";
import { INTAKE_FIELDS, MAX_ROUNDS, ORDER_STATUSES, SECTIONS, changeRequests, intakeLabel, intakeMax, intakeRequired, isBuilding, isMakingVideo, videoUnderWay, SUGGESTS_PER_DAY, TOPIC_MAX, type Intake, type Order, type SectionId } from "./store.ts";

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
@media(max-width:600px){.top nav a.hide{display:none}.top .wrap{gap:10px}.top nav a{white-space:nowrap}.brand{font-size:19px;gap:8px}.long{display:none}.short{display:inline}}

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
.frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.frame-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border:2px solid transparent;border-radius:14px;background:var(--soft);font:inherit;font-size:13px;line-height:1.2;color:inherit;cursor:pointer;text-align:center}
.frame-tile svg{width:100%;aspect-ratio:1}.frame-tile[aria-pressed=true]{border-color:var(--accent);background:var(--bg)}
.fs-stage{fill:var(--bg)}.fs-pic{fill:var(--accent);opacity:.35}.fs-text{fill:currentColor;opacity:.55}.fs-host{fill:var(--accent)}
.frames:has([aria-pressed=true])~.knobs[data-classic]{opacity:.45}
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
@media(max-width:860px){.ws{grid-template-columns:1fr;gap:24px}.side{display:none}}
.ws .content{display:flex;flex-direction:column;gap:64px;min-width:0}
.track{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.track li{border-top:6px solid var(--line);border-radius:3px 3px 0 0;padding-top:12px;font-weight:600;font-size:15.5px;color:var(--muted);min-width:0}
.track li.done{border-color:var(--ink);color:var(--ink)}.track li.now{border-color:var(--accent);color:var(--ink)}.track small{display:block;font-weight:400;font-size:14px;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:6px;font:600 13.5px/1 var(--body);padding:7px 12px;border-radius:99px;background:var(--soft);color:var(--muted)}
.pill.ok{background:color-mix(in srgb,var(--ok) 16%,transparent);color:var(--ok)}.pill.warn{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}
.sample{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:36px;align-items:center}.sample>div:last-child{display:flex;flex-direction:column;gap:14px;min-width:0;align-items:flex-start}
@media(max-width:600px){.sample{grid-template-columns:1fr}}
.decide{background:var(--surface);border-radius:24px;padding:18px 20px;display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}
.decide.ok{background:color-mix(in srgb,var(--ok) 11%,var(--surface))}.decide.warn{background:color-mix(in srgb,var(--warn) 9%,var(--surface))}
.decide form{display:contents}.decide .verdict{display:flex;align-items:center;gap:8px;font-weight:600;margin-right:auto}
.decide.ok .verdict{color:var(--ok)}.decide.warn .verdict{color:var(--warn)}
.decide .verdict svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.decide .asked{flex-basis:100%;font:400 17px/1.5 var(--body);color:var(--ink);padding-left:14px;border-left:3px solid var(--warn)}
.decide.warn .verdict{flex-basis:100%}.decide.warn .text{padding-left:0;padding-right:14px}
.decide:has(details[open]) .btn.yes,.decide.warn:has(details[open]) .text{display:none}.decide.warn details[open] .text{display:inline}
.decide .btn.yes{background:var(--ok);color:var(--surface)}
.decide .text,.ideas .text{font:600 15px/1 var(--body);color:var(--muted);background:none;border:0;padding:10px 6px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.decide .text:hover,.ideas .text:hover{color:var(--ink)}
.decide details>summary{list-style:none;cursor:pointer}.decide details>summary::-webkit-details-marker{display:none}
.decide details[open]{flex-basis:100%;order:2;display:flex;flex-direction:column;gap:12px}.decide details[open]>summary{display:none}
.decide details .inner{display:flex;flex-direction:column;gap:12px}
.decide [role=alert]{flex-basis:100%;order:3}.decide[aria-busy=true]{opacity:.6;pointer-events:none}
.finish{position:sticky;bottom:calc(12px + env(safe-area-inset-bottom));z-index:10;background:var(--ink);color:var(--bg);border-radius:24px;padding:14px 14px 14px 22px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:space-between;box-shadow:var(--lift)}
.finish .count{display:flex;flex-direction:column;gap:7px;font-weight:600;font-size:15.5px;min-width:0}
.finish .pips{display:flex;gap:4px}.finish .pips i{width:16px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--bg) 26%,transparent)}.finish .pips i.ok{background:var(--bg)}.finish .pips i.warn{background:var(--pop)}
.finish .btn{background:var(--pop);color:var(--on-pop)}.finish small{flex-basis:100%;font-size:14px;opacity:.78}
.finish form{display:contents}
.row{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}
.claims{display:flex;flex-direction:column;gap:16px;padding-left:22px;max-width:70ch}.claims li{font:400 17px/1.5 var(--body);color:var(--ink)}.claims small{display:block;font-size:14.5px;color:var(--muted);overflow-wrap:anywhere}.said{display:flex;flex-direction:column;gap:10px;max-width:70ch}.said small{display:block;font-size:14.5px;color:var(--muted)}#facts .decide{align-self:stretch}
.notice{background:var(--surface);border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
/* channel console: an approved channel's own app */
.cbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;height:60px;padding:0 20px;background:var(--surface);border-bottom:1px solid var(--line)}
.cbar .brand{font-size:19px}.cbar .sep{color:var(--line);font-size:22px}.cbar .chan{font:600 17px/1.2 var(--display);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cbar .state{margin-left:auto}.cbar .mine{font-size:14.5px;color:var(--muted);text-decoration:none;white-space:nowrap}.cbar .mine:hover{color:var(--ink)}
.state{display:inline-flex;align-items:center;gap:7px;font:600 13.5px/1 var(--body);padding:7px 11px;border-radius:99px;background:var(--soft);color:var(--muted);white-space:nowrap}.state i{width:8px;height:8px;border-radius:50%;background:var(--ok)}.state.paused i{background:var(--muted)}.state.busy i{background:var(--pop)}
.shell{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:calc(100vh - 60px)}
.rail{border-right:1px solid var(--line);padding:18px 12px;display:flex;flex-direction:column;gap:2px;position:sticky;top:60px;align-self:start;height:calc(100vh - 60px)}
.rail a{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;text-decoration:none;color:var(--muted);font-weight:500;font-size:15.5px}.rail a:hover{background:var(--soft);color:var(--ink)}
.rail a[aria-current]{background:var(--soft);color:var(--ink);font-weight:600}.rail svg{width:20px;height:20px;flex:none}.rail b{margin-left:auto;font:600 12.5px/1 var(--body);background:var(--surface);padding:4px 7px;border-radius:99px}
.pane{padding:32px clamp(18px,4vw,48px) 80px;display:flex;flex-direction:column;gap:28px;max-width:1080px;min-width:0}
.pane h1{font-size:clamp(28px,4vw,38px)}.pane h2{font-size:22px}.pane .head{display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-end;gap:12px 20px;justify-content:space-between}
.pane .head form{display:contents}.pane .tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.pane .tools form{display:contents}
.card{background:var(--surface);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;min-width:0}
.card>.swatches{align-self:stretch}.card .top-line{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%}.card .top-line a{font-size:14.5px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin:0}.stats div{background:var(--surface);border-radius:18px;padding:16px 18px}.stats dt{font:600 13.5px/1.2 var(--body);color:var(--muted)}.stats dd{margin:8px 0 0;font:600 30px/1 var(--display)}
.vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:14px;width:100%}.vids figure{margin:0;display:flex;flex-direction:column;gap:8px}.vids video{width:100%;aspect-ratio:9/16;border-radius:16px;background:#000;display:block}.vids figcaption{font-weight:600;font-size:15px;line-height:1.35}.vids a{font-size:14px}
.ideas{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;width:100%}.ideas li{background:var(--surface);border-radius:16px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}.card .ideas li{background:var(--bg)}
.ideas li>div{flex:1 1 240px;min-width:0}.ideas b{display:block;font-size:16px}.ideas small{color:var(--muted);font-size:14.5px}.ideas form{display:contents}.ideas .btn[disabled],.pane .btn[disabled]{opacity:.45;cursor:not-allowed;transform:none}
.ideas .text{font:600 15px/1 var(--body);color:var(--muted);background:none;border:0;padding:10px 6px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.ideas .text:hover{color:var(--ink)}
.fact{margin:8px 0 0;font-size:14.5px;line-height:1.45;color:var(--ink)}.fact span{display:inline-block;font:600 12px/1 var(--body);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-right:8px}.fact .src{font-size:14px;color:var(--muted);white-space:nowrap}a.src{color:var(--accent)}
.rail a.create{background:var(--ink);color:var(--bg);font-weight:600;margin-bottom:10px}.rail a.create:hover,.rail a.create[aria-current]{background:var(--ink);color:var(--bg);opacity:.88}
.review{font-size:14px}.review summary{cursor:pointer;color:var(--warn);font-weight:600}.review ul{margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}.review p{margin:6px 0 0;font-size:13.5px}
.track.three{grid-template-columns:repeat(3,minmax(0,1fr));list-style:none;margin:0;padding:0}
.track.four{list-style:none;margin:0;padding:0}
.part .shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,210px));gap:14px;margin:12px 0}
.part .shot{display:flex;flex-direction:column;gap:8px;min-width:0}
.part .shot img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:12px;border:1px solid var(--line)}
.part .shot.add{border:2px dashed var(--line);border-radius:12px;padding:12px;align-self:start}
.part .shot.add summary{cursor:pointer;font-weight:600}
.part textarea{min-height:84px}
.said1{margin:6px 0}.said1 span{display:inline-block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-right:8px}
label.check{display:flex;gap:8px;align-items:center;font-size:15px}
.caps{display:flex;flex-direction:column;gap:12px}.caps>button,.caps fieldset{align-self:flex-start}.caps .row3{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
.caps fieldset.hide{border:1px solid var(--line);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.caps input[type=color]{width:64px;height:40px;padding:2px}
form.own{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;width:100%}form.own label{flex:1 1 260px}
@media(max-width:820px){.shell{grid-template-columns:1fr}.rail{position:sticky;top:60px;z-index:15;height:auto;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line);background:var(--bg);padding:8px 12px;gap:4px}.rail a{flex:none;padding:9px 12px}.rail b{margin-left:4px}.cbar .mine{display:none}.pane{padding-top:22px}}
@media(max-width:480px){.cbar .sep,.cbar .brand span{display:none}}
.yours{display:flex;flex-wrap:wrap;gap:20px;align-items:center}.yours .vis{width:96px}.yours img.vis{aspect-ratio:1;object-fit:contain;background:var(--bg)}

/* orders */
.order{background:var(--surface);border-radius:24px;padding:24px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px 32px}
.order>div{display:flex;flex-direction:column;gap:10px;min-width:0}@media(max-width:760px){.order{grid-template-columns:1fr}}
.order select{flex:1;min-width:140px;padding:9px 12px}
code.link,pre.json{font:500 12.5px/1.5 ui-monospace,Menlo,monospace;word-break:break-all;user-select:all;background:var(--soft);padding:10px 12px;border-radius:12px;margin:0;white-space:pre-wrap}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn,.bar i{transition:none}}
`;

type Page = "home" | "demo" | "create" | "app";
/** Whether the visitor is signed in. Null = sign-in is switched off, so pages show no account links. */
export type Account = "in" | "out" | null;

/** Changes on every server start, so browsers never keep running an older copy of the script. */
const ASSET_VERSION = Date.now().toString(36);

const tag = (script: string, more = "") => `<script src="/assets/${script}.js?v=${ASSET_VERSION}" defer${more}></script>`;

function layout(product: string, title: string, page: Page, body: string, script: false | "app" | "workspace" = false, account: Account = null, head = ""): string {
  // The wizard's script holds back the first paint until it has run, so the form never jumps from all steps to one.
  const mine = account === "in" ? `<a href="/account"><span class="long">My channels</span><span class="short">Account</span></a>` : account === "out" ? `<a href="/signin">Sign in</a>` : "";
  const link = (href: string, label: string, key: Page, cls = "") => `<a href="${href}"${cls ? ` class="${cls}"` : ""}${page === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const nav = page === "app" ? "" : `<nav>${link("/#how", "How it works", "home", "hide")}${link("/demo", "Demo", "demo", account ? "hide" : "")}${mine}</nav><a class="btn sm" href="/create" aria-label="Design your channel"><span class="long">Design your channel</span><span class="short">Design</span></a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${head}${script === "app" ? tag("app", ' blocking="render"') : ""}<style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><i></i>${esc(product)}</a>${nav}</div></header>
<div class="wrap"><main${page === "app" ? ' class="app"' : ""}>${body}</main></div>
${page === "app" ? "" : `<footer><div class="wrap">${esc(product)}. Videos, voices and pictures are AI-generated and labelled where platforms require it.</div></footer>`}
${script === "workspace" ? tag("workspace") : ""}</body></html>`;
}

const ICONS = {
  kit: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/></svg>`,
  host: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>`,
  video: `<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/></svg>`,
};

export function landingPage(product: string, catalog: Catalog, account: Account = null): string {
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
    false,
    account,
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
export function demoPage(product: string, kit: BrandKit, account: Account = null): string {
  const tab = (id: string, label: string, checked = false) => `<label><input type="radio" name="tab" id="t-${id}"${checked ? " checked" : ""}>${label}</label>`;
  const shots = (name: string) => `<div class="frames">${[1, 2, 3].map((n) => `<img src="/assets/${name}-${n}.jpg" alt="${name} look, frame ${n}" loading="lazy">`).join("")}</div>`;
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
    false,
    account,
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
const BLANK_LOOK: Fields = { l_paper: "#f2f0f7", l_card: "#ffffff", l_ink: "#1a1838", l_text: "#1a1838", l_a: "#5a31f4", l_b: "#ffcf33", l_c: "#ff7a59", l_accent: "#5a31f4", l_display: "fredoka", l_body: "space-grotesk", l_casing: "normal", l_surface: "plain", l_backdrop: "blobs", l_texture: "none", l_motion: "snappy", l_art: "flat", l_host: "left", l_host_size: "medium", l_lettering: "middle", l_pictures: "beside", l_frames: "" };
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

const FRAME_NAMES: Record<string, string> = { "host-left": "Host on the left", "host-right": "Host on the right", "big-picture": "Big picture", split: "Split screen", "host-centre": "Host in the middle", "corner-host": "Host in the corner", "title-card": "Title card", "host-top": "Host up top", columns: "Columns", "picture-in-picture": "Picture in picture" };

/** Worlds to start from: a tap fills the world field, and the customer can change every word. */
const WORLDS = [
  "A cozy wizard's library inside a giant hollow tree, candlelight, floating books, storybook watercolour",
  "A retro-futurist space station orbiting Saturn, chrome and orange plastic, 1970s sci-fi paperback art",
  "A tiny world on a kitchen table, objects as big as buildings, soft morning light, claymation",
  "Ancient Rome at golden hour, marble, crowds of cloth awnings, painted like a museum fresco",
  "A deep-sea trench full of glowing creatures, bioluminescent blues, cinematic and photoreal",
  "A rainy cyberpunk market street, neon signs without words, reflections everywhere, anime",
];

/** A frame drawn small: the stage, the host's box, lettering lines and the picture. */
function frameSketch(f: Frame): string {
  const host = f.host ? `<rect x="${f.host.x + 3}" y="${f.host.y + 3}" width="${f.host.w - 6}" height="${f.host.h - 6}" rx="${Math.min(f.host.w, f.host.h) / 3}" class="fs-host"/>` : "";
  const pic = f.picture ? `<rect x="${f.picture.x + 2}" y="${f.picture.y + 2}" width="${f.picture.w - 4}" height="${f.picture.h - 4}" rx="4" class="fs-pic"/>` : "";
  const t = f.text;
  const lines = Math.max(1, Math.min(4, Math.floor(t.h / 12)));
  const top = t.y + (t.align === "top" ? 4 : t.align === "bottom" ? t.h - lines * 10 - 2 : (t.h - lines * 10) / 2);
  const text = Array.from({ length: lines }, (_, i) => `<rect x="${t.x + 4 + (i % 2) * 4}" y="${top + i * 10}" width="${t.w - 8 - (i % 2) * 12}" height="5" rx="2.5" class="fs-text"/>`).join("");
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="6" class="fs-stage"/>${pic}${text}${host}</svg>`;
}

/** The scene layouts a look can switch between. The picked ones are kept as JSON in `l_frames`, with any frames of the look's own. */
function frameTiles(value: string): string {
  let picked: unknown[] = [];
  try {
    picked = value ? (JSON.parse(value) as unknown[]) : [];
  } catch {
    // An unreadable value is reported by the look's check when the form is sent; here nothing shows as picked.
  }
  const on = new Set(picked.filter((f): f is string => typeof f === "string"));
  const own = picked.filter((f) => typeof f !== "string").length;
  return `<div class="frames" role="group" aria-label="Scene layouts">${FRAME_PRESET_NAMES.map((n) => `<button type="button" class="frame-tile" data-frame-pick="${n}" aria-pressed="${on.has(n)}">${frameSketch(FRAME_PRESETS[n])}<span>${esc(FRAME_NAMES[n] ?? words(n))}</span></button>`).join("")}</div><input type="hidden" name="l_frames" value="${esc(value)}">${own ? `<p class="muted">This look also has ${own} layout${own > 1 ? "s" : ""} of its own, kept as they are.</p>` : ""}`;
}

const ink = (name: string, label: string, value: string, slot = "") => `<label class="ink"><input type="color" name="${name}" value="${HEX.test(value) ? esc(value) : "#888888"}"><span${slot ? ` data-colour="${slot}"` : ""}>${esc(label)}</span></label>`;

/** The real creation: four short steps. The phone on the right is the customer's own host standing in their own look. */
export function createPage(product: string, catalog: Catalog, values: Fields = {}, errors: Partial<Record<keyof Intake, string>> = {}, account: Account = null): string {
  const look = values.look === OWN_LOOK || catalog.looks.some((l) => l.name === values.look) ? values.look : (catalog.looks[0]?.name ?? OWN_LOOK);
  const host = values.avatar === OWN_HOST || values.avatar === NO_HOST || catalog.hosts.some((h) => h.name === values.avatar) ? values.avatar : (catalog.hosts[0]?.name ?? OWN_HOST);
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
    start("avatar", NO_HOST, host, `<span class="vis blank">—</span>`, "No host, just the voice"),
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
<div class="progress"><p class="label" data-count>Step 1 of 4</p><div class="tools"><i></i></div></div>${any}
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
<p class="muted">Pick scene layouts and each video switches between them, beat by beat, choosing one its words and pictures fit. Pick none to keep one arrangement, set below.</p>
${frameTiles(lf.l_frames ?? "")}
<div class="knobs" data-classic>${knob("l_host", "Host stands", LOOK_CHOICES.l_host, lf.l_host, (o) => `On the ${o}`)}${knob("l_host_size", "Host size", LOOK_CHOICES.l_host_size, lf.l_host_size)}${knob("l_lettering", "Notes sit", LOOK_CHOICES.l_lettering, lf.l_lettering, (o) => ({ top: "High", middle: "In the middle", low: "Low, near the host" })[o] ?? words(o))}${knob("l_pictures", "Pictures go", LOOK_CHOICES.l_pictures, lf.l_pictures, (o) => (o === "beside" ? "Beside the host" : "Above the host"))}</div>
<details class="more"><summary>More settings</summary><div class="inks" style="margin-bottom:14px">${ink("l_card", "Cards", lf.l_card)}${ink("l_ink", "Text on cards", lf.l_ink)}${ink("l_text", "Text on background", lf.l_text)}</div>
<div class="knobs">${knob("l_body", "Small lettering", LOOK_CHOICES.l_body, lf.l_body, face)}${knob("l_texture", "Texture", LOOK_CHOICES.l_texture, lf.l_texture, (o) => (o === "grain" ? "Paper grain" : "Clean"))}</div></details></fieldset>
${field("look_note", values, errors, "area", "Optional. Anything the settings cannot say.", "Like a 1970s science textbook, a little faded")}
${field("world", values, errors, "area", "Where your stories happen and how they are drawn. Every line your host says is acted out in pictures of this world, with your host in them, so be as wild and specific as you like: the place, the era, the light, the art style. Leave it empty and we invent a simple cartoon world that suits your channel.", "A drowned neon city at night, glass towers under green water, schools of glowing fish, painted like a 1990s anime")}
<div class="chips">${WORLDS.map((w) => `<button type="button" class="chip" data-world="${esc(w)}">${esc(w.split(",")[0])}</button>`).join("")}</div></fieldset>
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
<div class="nav"><button type="button" class="btn ghost" data-back hidden>Back</button><span class="sp"></span>${account ? `<button type="submit" class="btn ghost" formaction="/draft" formnovalidate>Save for later</button>` : ""}<button type="button" class="btn" data-next hidden>Continue</button><button type="submit" class="btn accent" data-submit>Create my workspace</button></div>
${account === "out" ? `<p class="muted" style="font-size:14.5px">You sign in with Google when you save or send, so your channel is there when you come back.</p>` : ""}
</form>
<aside class="preview" aria-label="Your channel so far"><div class="phone"><div class="frame" data-frame data-casing="${esc(lf.l_casing)}" data-surface="${esc(lf.l_surface)}" data-backdrop="${esc(lf.l_backdrop)}" data-art="${esc(lf.l_art)}" data-host="${esc(lf.l_host)}" data-host_size="${esc(lf.l_host_size)}" data-lettering="${esc(lf.l_lettering)}" data-pictures="${esc(lf.l_pictures)}" style="${frameStyle(lf)}">
<div class="bd"></div><div class="plate">Your headline</div><div class="note"><b>The hook</b><span data-out="idea" data-empty="What your channel is about shows up here.">What your channel is about shows up here.</span></div>
<div class="art"></div><img class="host" data-host-img alt="Your host"${hostSrc ? ` src="${esc(hostSrc)}"` : " hidden"}><div class="cap">every word <mark>lights up</mark></div></div></div>
<p class="muted">A sketch of your look and host. Nothing is sent until the last step.</p></aside>
</section>`,
    "app",
    account,
  );
}

const STATUS_TEXT: Record<Order["status"], string> = {
  "awaiting-payment": "Waiting for payment",
  paid: "Paid — we are starting on your brand kit",
  "in-production": "In production",
  delivered: "Delivered",
};

/** The first video's step, in the customer's words. An order whose video is made by hand has no state: it reads as being made. */
const VIDEO_TEXT = { writing: "Script being written", facts: "Facts ready to check", painting: "Shots being painted", storyboard: "Storyboard ready to check", making: "First one being made", done: "First one ready", failed: "Did not finish" } as const;

function track(order: Order, hasKit: boolean): string {
  // The step the customer is on now: payment, then the brand kit (being made or under review), then done.
  const at = order.status === "awaiting-payment" ? 1 : order.status === "delivered" ? 4 : order.kit_approved ? 3 : 2;
  const steps = [
    ["Brief", "Sent"],
    ["Payment", order.status === "awaiting-payment" ? "Waiting" : order.no_payment ? "Not needed for now" : "Received"],
    ["Brand kit", order.kit_approved ? "Approved" : order.build?.kind === "revise" && isBuilding(order) ? "Changes being made" : hasKit ? "Ready to review" : order.build?.state === "failed" ? "Did not finish" : "Being made"],
    ["Videos", order.status === "delivered" ? "Delivered" : order.kit_approved ? VIDEO_TEXT[order.video?.state ?? "making"] : "After your approval"],
  ];
  return `<ol class="track">${steps.map(([name, note], i) => `<li class="${i < at ? "done" : i === at ? "now" : ""}">${esc(name)}<small>${esc(note)}</small></li>`).join("")}</ol>`;
}

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

/** One part's decision: approve in one tap, or say what to change. Saved in place by workspace.js; plain forms without it. */
function decisionCard(order: Order, id: SectionId): string {
  const d = order.decisions[id];
  const label = SECTIONS.find((s) => s.id === id)!.label;
  const post = (decision: string, inner: string) => `<form method="post" action="/w/${esc(order.token)}/decision" data-live-form><input type="hidden" name="section" value="${id}"><input type="hidden" name="decision" value="${decision}">${inner}</form>`;
  const ask = (summary: string, cls: string) =>
    `<details><summary class="${cls}">${summary}</summary>${post("change", `<div class="inner"><label class="f" for="note-${id}">What should be different?<textarea id="note-${id}" name="note" maxlength="600" required>${esc(d?.decision === "change" ? d.note : "")}</textarea></label><div class="row"><button type="submit" class="btn sm">Save request</button><button type="button" class="text" data-close>Cancel</button></div></div>`)}</details>`;
  let cls = "";
  let inner: string;
  if (order.kit_approved) {
    cls = " ok";
    inner = `<p class="verdict">${CHECK}Approved</p>`;
  } else if (d?.decision === "approve") {
    cls = " ok";
    inner = `<p class="verdict">${CHECK}Approved</p>${post("clear", `<button type="submit" class="text">Undo</button>`)}`;
  } else if (d?.decision === "change") {
    cls = " warn";
    inner = `<p class="verdict">Change requested</p><p class="asked">${esc(d.note)}</p>${ask("Edit", "text")}${post("clear", `<button type="submit" class="text">Remove</button>`)}${post("approve", `<button type="submit" class="text">Approve instead</button>`)}`;
  } else {
    inner = `${post("approve", `<button type="submit" class="btn yes">${CHECK.replace("<svg", `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"`)}Approve</button>`)}${ask("Ask for a change", "btn ghost")}`;
  }
  return `<div class="decide${cls}" id="decide-${id}" data-live role="group" aria-label="Your decision on: ${esc(label)}">${inner}</div>`;
}

function kitSection(order: Order, id: SectionId, content: string): string {
  const label = SECTIONS.find((s) => s.id === id)!.label;
  return `<section id="${id}" style="scroll-margin-top:88px"><h2>${esc(label)}</h2>${content}${decisionCard(order, id)}</section>`;
}

const NEXT_NAMES: Record<SectionId, string> = { name: "the name", host: "the host", colours: "the colours", look: "the look", format: "the format", tone: "the tone" };

/** The bar that follows the customer down the kit: how far they are, and the one thing to do next. */
function finishBar(order: Order, canRevise: boolean): string {
  if (order.kit_approved) return "";
  const pips = SECTIONS.map((s) => `<i class="${order.decisions[s.id]?.decision === "approve" ? "ok" : order.decisions[s.id] ? "warn" : ""}"></i>`).join("");
  const open = SECTIONS.filter((s) => !order.decisions[s.id]);
  const changes = changeRequests(order).length;
  const approved = SECTIONS.length - open.length - changes;
  const roundsLeft = MAX_ROUNDS - (order.rounds ?? 0);
  let count: string;
  let action: string;
  if (open.length) {
    count = `${SECTIONS.length - open.length} of ${SECTIONS.length} decided`;
    action = `<a class="btn sm" href="#${open[0].id}">Next: ${NEXT_NAMES[open[0].id]}</a>`;
  } else if (changes && canRevise && roundsLeft > 0) {
    count = `${approved} approved, ${changes} to change`;
    action = `<form method="post" action="/w/${esc(order.token)}/revise"><button type="submit" class="btn sm">Send ${changes} change${changes === 1 ? "" : "s"}</button></form><small>Your kit is revised and comes back here for you to approve. Revision ${MAX_ROUNDS - roundsLeft + 1} of ${MAX_ROUNDS}.</small>`;
  } else if (changes) {
    count = `${approved} approved, ${changes} to change`;
    action = `<small>Your change notes are saved. We make these by hand, and this page updates when they are done.</small>`;
  } else {
    count = "Everything approved";
    action = `<form method="post" action="/w/${esc(order.token)}/approve"><button type="submit" class="btn sm">Approve brand kit</button></form><small>This locks the kit and starts your first video.</small>`;
  }
  return `<div class="finish" id="finish" data-live><div class="count"><span aria-live="polite">${count}</span><span class="pips" aria-hidden="true">${pips}</span></div>${action}</div>`;
}

/** The fact-check, for the customer: every claim with its source, everything said and shown, and the decision. */
function factsHtml(order: Order, script: Script, first = true): string {
  const base = `/w/${esc(order.token)}`;
  const source = (text: string) => (/^https:\/\/\S+$/.test(text) ? `<a href="${esc(text)}" rel="noopener noreferrer nofollow" target="_blank">${esc(text)}</a>` : esc(text));
  const claims = script.claims.length
    ? `<ol class="claims">${script.claims.map((c) => `<li>${esc(c.claim)}<small>Source: ${source(c.source)}</small>${c.note ? `<small>${esc(c.note)}</small>` : ""}</li>`).join("")}</ol>`
    : `<p>This script lists no facts. If it states one, ask for a change.</p>`;
  const said = `<div class="said">${script.beats.map((b) => `<p>${esc(b.voiceover)}${b.on_screen_text ? `<small>On screen: ${esc(b.on_screen_text)}</small>` : ""}</p>`).join("")}</div>`;
  const left = MAX_ROUNDS - (order.video?.rounds ?? 0);
  const change =
    left > 0
      ? `<details><summary class="btn ghost">Ask for a change</summary><form method="post" action="${base}/facts"><input type="hidden" name="decision" value="change"><div class="inner"><label class="f" for="facts-note">Which fact is wrong, and what should change?<textarea id="facts-note" name="note" maxlength="600" required></textarea></label><div class="row"><button type="submit" class="btn sm">Send request</button><button type="button" class="text" data-close>Cancel</button></div><small class="muted">The script is written again and comes back here. Rewrite ${MAX_ROUNDS - left + 1} of ${MAX_ROUNDS}.</small></div></form></details>`
      : `<p class="muted">This script has been rewritten ${MAX_ROUNDS} times. Further changes are made by hand: quote <b>${esc(order.id)}</b> if you contact us.</p>`;
  return `<section class="notice" id="facts"><h2>Check the facts</h2><p class="muted">The script for your ${first ? "first " : ""}video, “${esc(script.title)}”, is written. Nothing is voiced or drawn until you approve every fact in it. Check each one against its source.</p>
${claims}
<h3>Everything that is said and shown</h3><p class="muted">Read it for any fact the list above missed.</p>${said}
<div class="decide" role="group" aria-label="Your decision on the facts"><form method="post" action="${base}/facts"><input type="hidden" name="decision" value="approve"><button type="submit" class="btn yes">Approve the facts</button></form>${change}</div><small class="muted">Approving starts the video. It is made exactly from these words.</small></section>`;
}

/** The channel's accent colour (the default caption highlight). */
function accentOf(kit: BrandKit): string {
  const accent = kit.colours.find((c) => c.name === "Accent");
  if (!accent) throw new Error(`The brand kit of "${kit.name}" has no accent colour.`);
  return accent.hex;
}

const CAPTION_SIZE_NAMES: Record<CaptionSettings["size"], string> = { small: "Small", medium: "Medium", large: "Large" };
const CAPTION_PLACE_NAMES: Record<CaptionSettings["place"], string> = { bottom: "Bottom", middle: "Middle" };

/** The caption settings form. `beats`: the video's parts, to switch captions off on some (absent for the channel's defaults). */
function captionsForm(action: string, c: CaptionSettings, accent: string, beats: Script["beats"] | null, submit: string): string {
  const select = (name: string, value: string, options: [string, string][]) =>
    `<select name="${name}" id="cap-${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const hide = beats
    ? `<fieldset class="hide"><legend>No captions on these parts</legend>${beats.map((b, i) => `<label class="check"><input type="checkbox" name="hide_${esc(b.id)}"${c.hide_beats.includes(b.id) ? " checked" : ""}> Part ${i + 1}: “${esc(b.voiceover.split(/\s+/).slice(0, 6).join(" "))}…”</label>`).join("")}</fieldset>`
    : "";
  return `<form class="caps" method="post" action="${action}">
<label class="check"><input type="checkbox" name="show"${c.show ? " checked" : ""}> Show captions</label>
<div class="row3"><label class="f" for="cap-size">Size${select("size", c.size, Object.entries(CAPTION_SIZE_NAMES))}</label><label class="f" for="cap-place">Where${select("place", c.place, Object.entries(CAPTION_PLACE_NAMES))}</label><label class="f" for="cap-case">Letters${select("case", c.case, [["normal", "As written"], ["upper", "ALL CAPS"]])}</label></div>
<div class="row3"><label class="check"><input type="checkbox" name="own_color"${c.color ? " checked" : ""}> My own highlight colour</label><label class="f" for="cap-color">Colour<input type="color" id="cap-color" name="color" value="${esc(c.color ?? accent)}"></label></div>
${hide}<button type="submit" class="btn ghost sm">${esc(submit)}</button></form>`;
}

/** The storyboard, for the customer: every part's line, its painted shots and on-screen text, and the captions, then the approval. */
function storyboardHtml(order: Order, sb: StoryboardView, accent: string): string {
  const base = `/w/${esc(order.token)}`;
  const part = (b: Script["beats"][number], i: number) => {
    const shots = ((b.visual as ThBeatVisual).shots ?? []) as Shot[];
    const words = voiceTokens(b.voiceover);
    const at = (n: number, chosen: string | undefined) =>
      n === 1 ? "" : `<label class="f" for="at-${esc(b.id)}-${n}">Cuts in on the word<select id="at-${esc(b.id)}-${n}" name="at_${n}"><option value="">Choose…</option>${words.map((w) => `<option value="${esc(w)}"${w === chosen ? " selected" : ""}>${esc(w)}</option>`).join("")}</select></label>`;
    const host = (n: number, on: boolean) => (sb.hostOnScreen ? `<label class="check"><input type="checkbox" name="host_${n}"${on ? " checked" : ""}> The host is in this shot</label>` : "");
    const slot = (n: number) => {
      const s = shots[n - 1];
      if (s) {
        const id = `${b.id}-${n}`;
        return `<div class="shot"><img src="${base}/shot/${esc(id)}?v=${esc(sb.pictures[id] ?? "")}" alt="Shot ${n}: ${esc(s.show)}" loading="lazy"><label class="f" for="show-${esc(id)}">What we see<textarea id="show-${esc(id)}" name="show_${n}" minlength="10" maxlength="500" required>${esc(s.show)}</textarea></label>${host(n, showsHost(s))}${at(n, s.at)}${shots.length > 1 ? `<label class="check"><input type="checkbox" name="remove_${n}"> Remove this shot</label>` : ""}</div>`;
      }
      if (n !== shots.length + 1) return "";
      return `<details class="shot add"><summary>Add a shot</summary><label class="f" for="show-${esc(b.id)}-${n}">What we see<textarea id="show-${esc(b.id)}-${n}" name="show_${n}" maxlength="500" placeholder="Close-up of …"></textarea></label>${host(n, false)}${at(n, undefined)}</details>`;
    };
    return `<form class="card part" method="post" action="${base}/storyboard/beat"><input type="hidden" name="beat" value="${esc(b.id)}">
<div class="top-line"><h3>Part ${i + 1}</h3></div><p class="said1"><span>Said</span>${esc(b.voiceover)}</p>
<div class="shots">${[1, 2, 3].map(slot).join("")}</div>
<label class="f" for="text-${esc(b.id)}">On-screen text <small>Leave it empty for none. Changing it sends the facts back to you to approve.</small><input type="text" id="text-${esc(b.id)}" name="text" maxlength="48" value="${esc(b.on_screen_text ?? "")}"></label>
<div class="row"><button type="submit" class="btn ghost sm">Save this part</button><small class="muted">A changed or added shot is painted again: ${sb.repaintsLeft} repaint${sb.repaintsLeft === 1 ? "" : "s"} left for this video.</small></div></form>`;
  };
  return `<div class="card"><h2>Check your storyboard</h2><p class="muted">Every shot of “${esc(sb.script.title)}” is painted. Change what a shot shows${sb.hostOnScreen ? ", whether the host is in it," : ""} or the on-screen text, add or remove shots, and set the captions. Nothing is voiced until you approve.</p></div>
${sb.script.beats.map(part).join("")}
<div class="card"><h2>Captions</h2><p class="muted">The words always match what is said. Choose how they look, or switch them off.</p>${captionsForm(`${base}/storyboard/captions`, sb.captions, accent, sb.script.beats, "Save captions")}</div>
<div class="card"><div class="decide" role="group" aria-label="Your decision on the storyboard"><form method="post" action="${base}/storyboard/approve"><button type="submit" class="btn yes">Approve the storyboard</button></form></div><small class="muted">Approving voices and renders the video exactly like this.</small></div>`;
}

/** What stands where the first video will be, until it is there. */
function videoNotice(order: Order, facts: Script | null): string {
  const v = order.video;
  if (v?.state === "facts" && facts) return factsHtml(order, facts);
  if (v?.state === "writing")
    return `<section class="notice" id="next"><h2>Your first video is being written</h2><p class="muted">${v.rounds ? "The script is being written again with your change." : "Your brand kit is approved and the script is being written."} This takes several minutes. Its facts appear here for you to check before anything is voiced or drawn.</p></section>`;
  if (v?.state === "painting") return `<section class="notice" id="next"><h2>The shots of your first video are being painted</h2><p class="muted">Its facts are approved. When the pictures are ready you check them, and the captions, before anything is voiced.</p></section>`;
  if (v?.state === "storyboard") return `<section class="notice" id="next"><h2>Check your storyboard</h2><p class="muted">Every shot of your first video is painted. Look at them, change what you want, then approve the storyboard to make the video.</p><a class="btn sm" href="/w/${esc(order.token)}?view=new">Open the storyboard</a></section>`;
  if (v?.state === "making") return `<section class="notice" id="next"><h2>Your first video is being made</h2><p class="muted">It is being voiced, drawn and checked. This takes several minutes, and the video appears here by itself.</p></section>`;
  if (v?.state === "failed")
    return `<section class="notice" id="next" role="alert"><h2>Your first video did not finish</h2><p class="muted">Something went wrong while it was being ${v.failed_at === "making" ? "made" : "written"}, and it has to be started again on our side. Nothing is lost. Quote <b>${esc(order.id)}</b> if you contact us.</p></section>`;
  return `<section class="notice" id="next"><h2>Brand kit approved</h2><p class="muted">Your first video is being made from this kit. It appears here when it has passed its checks. Nothing else is needed from you right now.</p></section>`;
}

function kitHtml(order: Order, kit: BrandKit, canRevise: boolean, facts: Script | null): string {
  const base = `/w/${esc(order.token)}`;
  const latest = kit.episodes[kit.episodes.length - 1];
  const video = latest
    ? `<section><h2>Your first video</h2><div class="sample"><div class="phone"><video controls playsinline preload="metadata" src="${base}/video/${esc(latest.id)}"></video></div><div><h3>${esc(latest.title)}</h3><p class="muted">The finished video, exactly as it would be posted. Everything below is what it is made of.</p><a class="btn sm" href="${base}/video/${esc(latest.id)}?download=1">Download the video</a></div></div></section>`
    : order.kit_approved
      ? videoNotice(order, facts)
      : `<section class="notice"><h2>Review your brand kit</h2><p class="muted">Approve each part, or say what to change. When every part is approved, one last button locks the kit and starts your first video.</p></section>`;
  const failed = order.build?.kind === "revise" && order.build.state === "failed" ? `<section class="notice" role="alert"><h2>Your changes did not finish</h2><p class="muted">Something went wrong while they were being made. Your kit and your notes are as you left them: send the changes again from the bar below.</p></section>` : "";
  const frames = latest && latest.frames.length ? `<div class="frames">${latest.frames.map((f) => `<img src="${base}/frame/${esc(latest.id)}/${esc(f)}" alt="A frame from the video">`).join("")}</div>` : "";
  const side = `<nav class="side" id="side" data-live aria-label="Brand kit sections">${SECTIONS.map((s) => {
    const d = order.decisions[s.id];
    return `<a href="#${s.id}"><span class="dot ${order.kit_approved || d?.decision === "approve" ? "ok" : d ? "warn" : ""}"></span>${esc(s.label)}</a>`;
  }).join("")}</nav>`;
  return `<div class="ws">${side}<div class="content">
${failed}${video}
${kitSection(order, "name", `<p class="display" style="font-size:clamp(30px,5vw,46px)">${esc(kit.name)}</p><p class="lede">${esc(kit.promise)}</p>${identityFacts(kit)}`)}
${kitSection(order, "host", `<p class="lede"><b style="color:var(--ink)">${esc(kit.host.name)}.</b> ${esc(kit.host.concept)}</p>${hostFacts(kit)}`)}
${kitSection(order, "colours", `${swatches(kit)}<p class="muted">Lettering: ${esc(kit.font)}</p>`)}
${kitSection(order, "look", `<p>${esc(kit.series.visual_style)}</p>${frames}`)}
${kitSection(order, "format", `<p class="lede">${esc(kit.series.format)}</p>${beats(kit)}`)}
${kitSection(order, "tone", `<div class="kv"><div><p class="label">Feels</p>${items(kit.tone, "chips")}</div><div><p class="label">Always</p>${items(kit.styleNotes, "list")}</div><div><p class="label">Never</p>${items(kit.never, "list no")}</div></div>`)}
${finishBar(order, canRevise)}
</div></div>`;
}

/** What the channel is doing right now, on its dashboard. `newVideo`: the address of the New video flow. */
function nowHtml(order: Order, dash: Dashboard, facts: Script | null, made: number, newVideo: string, settings: string): string {
  const v = order.video;
  const title = (t: string) => `<section class="card" id="now">${t}</section>`;
  if (v?.state === "facts" && facts) return factsHtml(order, facts, made === 0).replace('class="notice" id="facts"', 'class="card" id="now"');
  if (v?.state === "writing") return title(`<h2>A video is being written</h2><p class="muted">${v.rounds ? "The script is being written again with your change." : "The script is being written."} This takes several minutes. Its facts appear here for you to check before anything is voiced or drawn.</p>`);
  if (v?.state === "painting") return title(`<h2>Shots are being painted</h2><p class="muted">When they are ready you check them, and the captions, before anything is voiced.</p>`);
  if (v?.state === "storyboard") return title(`<h2>Your storyboard is ready</h2><p class="muted">Every shot is painted. Look at them, change what you want, then approve to make the video.</p><a class="btn sm" href="${newVideo}">Open the storyboard</a>`);
  if (v?.state === "making") return title(`<h2>A video is being made</h2><p class="muted">It is being voiced, drawn and checked. This takes several minutes, and it appears in Videos by itself.</p>`);
  if (v?.state === "failed")
    return title(`<h2>The last video did not finish</h2><p class="muted">Something went wrong while it was being ${v.failed_at === "making" ? "made" : "written"}. Nothing is lost: start another one, and quote <b>${esc(order.id)}</b> if you contact us about it.</p><a class="btn sm" href="${newVideo}">New video</a>`);
  if (dash.paused) return title(`<h2>The channel is paused</h2><p class="muted">No new videos are made while it is paused.</p><a class="btn sm" href="${settings}">Resume it in Settings</a>`);
  return title(`<h2>${made ? "Ready for the next video" : "Ready for your first video"}</h2><p class="muted">Pick an idea or give your own topic, and the script is written for you. You check its facts before anything is voiced or drawn.</p><a class="btn sm" href="${newVideo}">New video</a>`);
}

export type ConsoleView = "overview" | "new" | "videos" | "ideas" | "settings";
export const CONSOLE_VIEWS: readonly ConsoleView[] = ["overview", "new", "videos", "ideas", "settings"];
/** The areas in the console's menu ("new" is the button above them). */
const RAIL_VIEWS = ["overview", "videos", "ideas", "settings"] as const;

const RAIL_ICONS: Record<(typeof RAIL_VIEWS)[number], string> = {
  overview: `<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/>`,
  videos: `<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>`,
  ideas: `<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
};

/** A link to where an idea's fact can be checked; the address as plain text when it is not an https web address. */
function factSource(source: string): string {
  if (!/^https:\/\/\S+$/.test(source) || !URL.canParse(source)) return `<span class="src">Source: ${esc(source)}</span>`;
  return `<a class="src" href="${esc(source)}" target="_blank" rel="noopener noreferrer nofollow">Check it at ${esc(new URL(source).hostname.replace(/^www\./, ""))}</a>`;
}

/** The QA review's notes on a finished video: shown, not blocking. */
function reviewHtml(notes: string[]): string {
  if (!notes.length) return "";
  return `<details class="review"><summary>Review notes (${notes.length})</summary><p class="muted">Our automatic review would change these. The video is finished; they are for the next one.</p><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`;
}

/** An idea's title, angle and the fact it turns on, with where to check that fact. */
function ideaBody(i: Idea): string {
  const fact = i.fields.fact;
  const source = i.fields.fact_source;
  const yours = i.fields.by === "customer" ? `<small>Your own topic</small>` : "";
  return `<div><b>${esc(i.title)}</b>${i.angle ? `<small>${esc(i.angle)}</small>` : yours}${fact ? `<p class="fact"><span>Key fact</span>${esc(fact)}${source ? ` ${factSource(source)}` : ""}</p>` : ""}</div>`;
}

/**
 * An approved channel's own app, like a project in a cloud console: a bar with the channel's name and state,
 * a menu of its areas, and one area at a time. The order (brief, payment, kit review) is behind it now.
 */
function consolePage(product: string, order: Order, kit: BrandKit, dash: Dashboard, facts: Script | null, view: ConsoleView): string {
  const base = `/w/${esc(order.token)}`;
  const at = (v: ConsoleView) => (v === "overview" ? base : `${base}?view=${v}`);
  const busy = videoUnderWay(order);
  const made = kit.episodes.length;
  // Why a video can't be started now, if it can't.
  const blocked = busy ? "A video is under way" : dash.paused ? "The channel is paused" : dash.videosLeftToday === 0 ? "No more videos today" : "";
  const blockedWhy = busy ? "Start the next video when this one is finished." : dash.paused ? "Resume the channel under Settings to make videos." : "You can start more tomorrow.";
  const disabled = blocked ? ` disabled title="${esc(blocked)}"` : "";
  const suggesting = order.suggest?.state === "running";
  const suggestBtn = (cls: string) =>
    suggesting
      ? `<button type="button" class="btn ${cls}" disabled>Writing new ideas…</button>`
      : dash.suggestsLeftToday
        ? `<form method="post" action="${base}/suggest"><button type="submit" class="btn ${cls}">Suggest new ideas</button></form>`
        : `<button type="button" class="btn ${cls}" disabled title="Ask again tomorrow">No more suggestions today</button>`;
  const makeBtn = (i: Idea) => `<form method="post" action="${base}/make"><input type="hidden" name="idea" value="${esc(i.id)}"><button type="submit" class="btn sm"${disabled}>Make this video</button></form>`;
  const idea = (i: Idea) => `<li>${ideaBody(i)}${makeBtn(i)}<form method="post" action="${base}/idea"><input type="hidden" name="idea" value="${esc(i.id)}"><button type="submit" class="text">Not for me</button></form></li>`;
  const decide = (draft: string, ideaId: string, d: "keep" | "skip" | "keep-all", label: string, cls: string) =>
    `<form method="post" action="${base}/proposal"><input type="hidden" name="draft" value="${esc(draft)}">${ideaId ? `<input type="hidden" name="idea" value="${esc(ideaId)}">` : ""}<input type="hidden" name="decision" value="${d}"><button type="submit" class="${cls}">${label}</button></form>`;
  const proposal = (p: Dashboard["proposals"][number]) => `<li>${ideaBody(p.idea)}${decide(p.draft, p.idea.id, "keep", "Keep", "btn sm")}${decide(p.draft, p.idea.id, "skip", "Skip", "text")}</li>`;
  const tiles = (eps: BrandKit["episodes"]) =>
    `<div class="vids">${eps.map((e) => `<figure><video controls playsinline preload="metadata" src="${base}/video/${esc(e.id)}"></video><figcaption>${esc(e.title)}</figcaption><a href="${base}/video/${esc(e.id)}?download=1">Download</a>${reviewHtml(e.review)}</figure>`).join("")}</div>`;
  const newest = [...kit.episodes].reverse();
  const blockedNote = blocked && dash.ideas.length ? `<p class="muted" style="font-size:14.5px">${esc(blocked)}: ${esc(blockedWhy.charAt(0).toLowerCase() + blockedWhy.slice(1))}</p>` : "";

  let main: string;
  if (view === "new") {
    const v = order.video;
    // Looks with a painted world stop at a storyboard between the facts and the video.
    const boards = dash.hostOnScreen !== null;
    const step = v?.state === "writing" || v?.state === "facts" ? 1 : v?.state === "painting" || v?.state === "storyboard" ? 2 : v?.state === "making" ? (boards ? 3 : 2) : 0;
    const steps: [string, string][] = [
      ["Choose a topic", step === 0 ? "Now" : "Done"],
      ["Check the facts", step === 1 ? (v?.state === "facts" ? "Your turn" : "Being written") : step > 1 ? "Approved" : "Next"],
      ...(boards ? [["Storyboard", step === 2 ? (v?.state === "storyboard" ? "Your turn" : "Being painted") : step > 2 ? "Approved" : "Next"] as [string, string]] : []),
      ["Get the video", step === (boards ? 3 : 2) ? "Being made" : "Last"],
    ];
    const track = `<ol class="track ${boards ? "four" : "three"}">${steps.map(([name, note], i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${esc(name)}<small>${esc(note)}</small></li>`).join("")}</ol>`;
    let body: string;
    if (step === 1 && v?.state === "facts" && facts) body = factsHtml(order, facts, made === 0).replace('class="notice" id="facts"', 'class="card" id="facts"');
    else if (step === 1) body = `<div class="card"><h2>The script is being written</h2><p class="muted">${v?.rounds ? "It is being written again with your change." : "This takes several minutes."} Its facts appear here for you to check before anything is voiced or drawn. This page updates by itself.</p></div>`;
    else if (v?.state === "storyboard" && dash.storyboard) body = storyboardHtml(order, dash.storyboard, accentOf(kit));
    else if (v?.state === "painting") body = `<div class="card"><h2>The shots are being painted</h2><p class="muted">This takes a minute or two. Then you check every shot and the captions here before anything is voiced. This page updates by itself.</p></div>`;
    else if (step > 0) body = `<div class="card"><h2>Your video is being made</h2><p class="muted">${boards ? "The storyboard is approved." : "The facts are approved."} It is being voiced, drawn and checked, which takes several minutes. It appears here and in Videos by itself.</p></div>`;
    else {
      const last = v?.state === "done" && v.idea && v.episode ? kit.episodes.find((e) => e.id === v.episode) : undefined;
      const ready = last ? `<div class="card"><h2>Your new video is ready</h2>${tiles([last])}<p class="muted">Download it and post it. Make the next one below.</p></div>` : "";
      const failed = v?.state === "failed" ? `<div class="card" role="alert"><h2>The last video did not finish</h2><p class="muted">Something went wrong while it was being ${v.failed_at === "making" ? "made" : "written"}. Nothing is lost: start another one. Quote <b>${esc(order.id)}</b> if you contact us about it.</p></div>` : "";
      const stop = blocked ? `<div class="card" role="status"><h2>${esc(blocked)}</h2><p class="muted">${esc(blockedWhy)}</p>${dash.paused ? `<a class="btn sm" href="${at("settings")}">Go to Settings</a>` : ""}</div>` : "";
      body = `${ready}${failed}${stop}
<div class="card"><div class="top-line"><h2>Pick one of your ideas</h2><a href="${at("ideas")}">Get more ideas</a></div><p class="muted">Each idea shows the fact it is built on. Check it at its source, then make the video.</p>${dash.ideas.length ? `<ul class="ideas">${dash.ideas.map((i) => `<li>${ideaBody(i)}${makeBtn(i)}</li>`).join("")}</ul>` : `<p class="muted">No ideas are waiting.</p>${suggestBtn("ghost sm")}`}</div>
<div class="card"><h2>Or give your own topic</h2><form class="own" method="post" action="${base}/make"><label class="f" for="topic">What should the video be about?<input type="text" id="topic" name="topic" minlength="4" maxlength="${TOPIC_MAX}" required placeholder="Why the sea is salty"${blocked ? " disabled" : ""}></label><button type="submit" class="btn sm"${disabled}>Write this video</button></form><small class="muted">It must fit ${esc(kit.name)}. The script is written first, and you check every fact before anything is voiced or drawn.</small></div>`;
    }
    main = `<div class="head"><div><p class="eyebrow">${esc(kit.name)}</p><h1>New video</h1></div></div>${track}${body}`;
  } else if (view === "videos") {
    main = `<div class="head"><h1>Videos</h1><a class="btn sm" href="${at("new")}">New video</a></div>${made ? tiles(newest) : `<div class="card"><p class="muted">Your finished videos appear here, ready to download.</p><a class="btn sm" href="${at("new")}">Make your first video</a></div>`}`;
  } else if (view === "ideas") {
    const suggestState =
      order.suggest?.state === "running"
        ? `<p class="muted" role="status">New ideas${order.suggest.direction ? ` about “${esc(order.suggest.direction)}”` : ""} are being written for your channel. This takes a minute or two, and they appear below by themselves.</p>`
        : order.suggest?.state === "failed"
          ? `<p class="error" role="alert">The last request for ideas did not finish. Nothing is lost: ask again.</p>`
          : "";
    const ask = suggesting
      ? `<button type="button" class="btn sm" disabled>Writing new ideas…</button>`
      : dash.suggestsLeftToday
        ? `<form class="own" method="post" action="${base}/suggest"><label class="f" for="direction">About what? <small>Optional. Leave it empty for ideas across the whole channel.</small><input type="text" id="direction" name="direction" maxlength="${TOPIC_MAX}" placeholder="The deep sea"></label><button type="submit" class="btn sm">Suggest ideas</button></form>`
        : `<button type="button" class="btn sm" disabled title="Ask again tomorrow">No more suggestions today</button>`;
    const batches = [...new Set(dash.proposals.map((p) => p.draft))].map((draft) => dash.proposals.filter((p) => p.draft === draft));
    const batch = (ps: Dashboard["proposals"]) =>
      `<div class="card"><div class="top-line"><h2>Suggested for you</h2>${ps.length > 1 ? decide(ps[0].draft, "", "keep-all", `Keep all ${ps.length}`, "btn ghost sm") : ""}</div><p class="muted">Check each key fact at its source. Kept ideas join your ideas, ready to make. Skipped ones are never made.</p><ul class="ideas">${ps.map(proposal).join("")}</ul></div>`;
    main = `<div class="head"><h1>Ideas</h1></div>
<div class="card"><div class="top-line"><h2>Get new ideas</h2><small class="muted">${dash.suggestsLeftToday} of ${SUGGESTS_PER_DAY} left today</small></div>${suggestState}${ask}</div>
${batches.map(batch).join("")}
<div class="card"><div class="top-line"><h2>Waiting to be made</h2><a href="${at("new")}">New video</a></div>${dash.ideas.length ? `<ul class="ideas">${dash.ideas.map(idea).join("")}</ul>${blockedNote}` : `<p class="muted">No ideas are waiting. Ask for new ones above.</p>`}</div>`;
  } else if (view === "settings") {
    main = `<div class="head"><h1>Settings</h1></div>
<div class="card"><h2>Channel</h2><p class="display" style="font-size:26px">${esc(kit.name)}</p><p class="muted">${esc(kit.promise)}</p></div>
<div class="card"><h2>Host</h2><p><b>${esc(kit.host.name)}.</b> ${esc(kit.host.concept)}</p>${
      dash.hostOnScreen === null
        ? ""
        : `<p class="muted">${dash.hostOnScreen ? "The host appears in the shots that call for it. Take it off screen and the voice narrates every video on its own." : "The host is off screen: the voice narrates every video. Put it back to have it appear in the shots that call for it."}</p><form method="post" action="${base}/host"><input type="hidden" name="on" value="${dash.hostOnScreen ? "0" : "1"}"><button type="submit" class="btn ghost sm"${busy ? ` disabled title="A video is under way"` : ""}>${dash.hostOnScreen ? "Take the host off screen" : "Put the host on screen"}</button></form>`
    }</div>
<div class="card"><h2>Captions</h2><p class="muted">How captions look in every new video. You can still change them on each video's storyboard.</p>${captionsForm(`${base}/captions`, dash.captions, accentOf(kit), null, "Save caption settings")}</div>
<div class="card"><h2>Look</h2>${swatches(kit)}<p class="muted">${esc(kit.series.visual_style)}</p></div>
<div class="card"><h2>Format</h2><p class="muted">${esc(kit.series.format)}</p></div>
<div class="card"><h2>${dash.paused ? "Paused" : "Making videos"}</h2><p class="muted">${dash.paused ? "No new videos are made while the channel is paused. Nothing is lost." : "Pausing stops new videos. Nothing is lost, and you can resume at any time."}</p><form method="post" action="${base}/channel"><input type="hidden" name="status" value="${dash.paused ? "active" : "paused"}"><button type="submit" class="btn ${dash.paused ? "" : "ghost "}sm">${dash.paused ? "Resume the channel" : "Pause the channel"}</button></form></div>`;
  } else {
    main = `<div class="head"><div><p class="eyebrow">Overview</p><h1>${esc(kit.name)}</h1></div><div class="tools"><a class="btn sm" href="${at("new")}">New video</a>${suggestBtn("ghost sm")}</div></div>
<dl class="stats"><div><dt>Videos made</dt><dd>${made}</dd></div><div><dt>Ideas waiting</dt><dd>${dash.ideas.length}</dd></div><div><dt>Videos left today</dt><dd>${dash.videosLeftToday}</dd></div></dl>
${nowHtml(order, dash, facts, made, at("new"), at("settings"))}
<div class="card"><div class="top-line"><h2>Latest videos</h2>${made > 3 ? `<a href="${at("videos")}">All ${made}</a>` : ""}</div>${made ? tiles(newest.slice(0, 3)) : `<p class="muted">Your finished videos appear here.</p>`}</div>
<div class="card"><div class="top-line"><h2>Up next</h2><a href="${at("ideas")}">All ideas</a></div>${dash.ideas.length ? `<ul class="ideas">${dash.ideas.slice(0, 3).map(idea).join("")}</ul>${blockedNote}` : `<p class="muted">No ideas are waiting.</p>${suggestBtn("sm")}`}</div>`;
  }
  const counts: Partial<Record<ConsoleView, number>> = { videos: made, ideas: dash.ideas.length + dash.proposals.length };
  const names: Record<ConsoleView, string> = { overview: "Overview", new: "New video", videos: "Videos", ideas: "Ideas", settings: "Settings" };
  const rail = `<nav class="rail" aria-label="${esc(kit.name)}"><a class="create" href="${at("new")}"${view === "new" ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New video</a>${RAIL_VIEWS.map(
    (v) =>
      `<a href="${at(v)}"${v === view ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RAIL_ICONS[v]}</svg>${names[v]}${counts[v] ? `<b>${counts[v]}</b>` : ""}</a>`,
  ).join("")}</nav>`;
  const state = dash.paused ? `<span class="state paused"><i></i>Paused</span>` : busy ? `<span class="state busy"><i></i>Working</span>` : `<span class="state"><i></i>Active</span>`;
  const waiting = isMakingVideo(order) || suggesting;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(names[view])} — ${esc(kit.name)}</title>${waiting ? `<meta http-equiv="refresh" content="20">` : ""}<style>${CSS}</style></head><body>
<header class="cbar"><a class="brand" href="/"><i></i><span>${esc(product)}</span></a><span class="sep" aria-hidden="true">/</span><span class="chan">${esc(kit.name)}</span>${state}${order.user ? `<a class="mine" href="/account">My channels</a>` : ""}</header>
<div class="shell">${rail}<main class="pane">${main}</main></div>
</body></html>`;
}

/** `canRevise`: change requests are made automatically (automatic builds are on). `facts`: the script whose facts the customer is checking, if any. `dash`: the channel's dashboard, once it has one. */
export function workspacePage(product: string, order: Order, kit: BrandKit | null, paymentUrl: string | null, canRevise: boolean, facts: Script | null = null, dash: Dashboard | null = null, view: ConsoleView = "overview"): string {
  // An approved channel built here is its own app from now on.
  if (kit && dash) return consolePage(product, order, kit, dash, facts, view);
  const d = order.design;
  const yours = d && (d.theme || d.model) ? `<div class="yours">${d.theme ? lookSwatch(d.theme) : ""}${d.model && HOST_RIGS[d.model.rig] ? `<img class="vis" src="${esc(hostPreviewUrl(hostFields(d.model)))}" alt="Your host">` : ""}<p class="muted" style="max-width:36ch">The look and host you designed. Your brand kit is built from these.</p></div>` : "";
  const brief = `<section><h2>Your brief</h2>${yours}<dl class="kv notice" style="display:grid">${INTAKE_FIELDS.filter((f) => f !== "email" && order.intake[f]).map((f) => `<div><dt>${esc(intakeLabel(f))}</dt><dd>${esc(order.intake[f] ?? "")}</dd></div>`).join("")}</dl></section>`;
  // While something is being made the page reloads itself, so the result shows up without a tap.
  const waiting = order.status !== "awaiting-payment" && (isBuilding(order) || isMakingVideo(order));
  const revising = waiting && isBuilding(order) && order.build?.kind === "revise";
  let body: string;
  if (order.status === "awaiting-payment") {
    body = paymentUrl
      ? `<section class="notice"><h2>One step left</h2><p class="muted">Work starts when payment arrives. Quote reference <b>${esc(order.id)}</b> if asked.</p><a class="btn accent" href="${esc(paymentUrl)}" rel="noopener">Pay securely</a></section>`
      : `<section class="notice"><h2>One step left</h2><p class="muted">Work starts when payment arrives. Online payment is not switched on yet, so we will contact you at the email you gave. Your reference is <b>${esc(order.id)}</b>.</p></section>`;
  } else if (revising) {
    body = `<section class="notice"><h2>Your changes are being made</h2><p class="muted">This takes several minutes. The revised kit appears here by itself, with the changed parts ready for you to look at again.</p></section>`;
  } else if (!kit) {
    body =
      order.build?.state === "failed"
        ? `<section class="notice"><h2>Your brand kit did not finish</h2><p class="muted">Something went wrong while it was being made, and it has to be started again on our side. Nothing is lost. Quote <b>${esc(order.id)}</b> if you contact us.</p></section>`
        : order.build
          ? `<section class="notice"><h2>Your brand kit is being made</h2><p class="muted">This takes several minutes. It appears here by itself, part by part, for you to approve.</p></section>`
          : `<section class="notice"><h2>Your brand kit is being made</h2><p class="muted">It appears on this page, section by section, for you to approve. Nothing else is needed from you right now.</p></section>`;
  } else {
    body = kitHtml(order, kit, canRevise, facts);
  }
  return layout(
    product,
    `Your workspace — ${product}`,
    "app",
    `<section><div class="row"><p class="eyebrow">Order ${esc(order.id)}</p><span class="pill">${esc(STATUS_TEXT[order.status])}</span></div>
<h1>Hello, ${esc(order.intake.contact_name)}</h1>
${track(order, kit !== null)}
<p class="muted" style="font-size:14.5px;max-width:70ch">${order.user ? `This page is private to you. Anyone with its link can open it, so keep the link like a password. You can always find it again under <a href="/account">My channels</a>.` : `This page is private to you. Anyone with its link can open it, so keep the link like a password and bookmark it now — there is no login to get it back.`}</p></section>
${body}${brief}`,
    kit && !revising ? "workspace" : false,
    null,
    waiting ? `<meta http-equiv="refresh" content="20">` : "",
  );
}

/** Everything one account has: the design saved for later, and each channel with where it stands. */
export function accountPage(product: string, user: User, orders: Order[], kitReady: ReadonlySet<string>, draft: Draft | undefined): string {
  const saved = draft
    ? `<section class="notice"><h2>Your saved design</h2><p class="muted">${draft.form.idea ? esc(draft.form.idea) : "Not described yet."} Saved ${esc(draft.saved.slice(0, 10))}.</p><a class="btn" href="/create">Continue designing</a></section>`
    : "";
  const cards = orders
    .slice()
    .reverse()
    .map(
      (o) =>
        `<article class="notice"><div class="row"><h3>${esc(o.intake.idea)}</h3><span class="pill">${esc(STATUS_TEXT[o.status])}</span></div><p class="muted" style="font-size:14.5px">Order ${esc(o.id)} · sent ${esc(o.created.slice(0, 10))}</p>${track(o, kitReady.has(o.id))}<a class="btn sm" href="/w/${esc(o.token)}">Open workspace</a></article>`,
    )
    .join("");
  return layout(
    product,
    `My channels — ${product}`,
    "app",
    `<section><div class="row"><p class="eyebrow">Signed in as ${esc(user.email)}</p><form method="post" action="/signout"><button type="submit" class="btn sm ghost">Sign out</button></form></div>
<h1>My channels</h1></section>
${saved}
<section>${cards || (draft ? "" : `<p class="muted">Nothing here yet. Design your first channel and it shows up on this page.</p>`)}<div><a class="btn accent" href="/create?new">Design a new channel</a></div></section>`,
  );
}

export function adminPage(product: string, orders: Order[], channels: string[], publicBase: string, autoBuild: boolean): string {
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
${o.kit_approved ? `<p><span class="pill ok">Kit approved ${esc(o.kit_approved.slice(0, 10))}</span>${o.video ? "" : " The first video is yours to make."}</p>` : ""}${o.video ? `<p class="muted" style="font-size:14.5px">First video: ${esc(o.video.state)}${o.video.episode ? ` (${esc(o.video.episode)})` : ""}, attempt ${o.video.attempts}, script rewritten ${o.video.rounds} of ${MAX_ROUNDS} times, ${esc(o.video.at.slice(0, 16).replace("T", " "))}${o.video.error ? ` — ${esc(o.video.error)}` : ""}</p>` : ""}${autoBuild && o.video?.state === "failed" ? `<form method="post" action="/orders/${esc(o.id)}/video"><button type="submit" class="btn sm">Make the video again</button></form>` : ""}${o.rounds ? `<p class="muted" style="font-size:14.5px">Revised ${o.rounds} of ${MAX_ROUNDS} times</p>` : ""}${o.build ? `<p class="muted" style="font-size:14.5px">Automatic ${o.build.kind === "revise" ? "revision" : "build"}: ${esc(o.build.state)}, attempt ${o.build.attempts}, ${esc(o.build.at.slice(0, 16).replace("T", " "))}${o.build.error ? ` — ${esc(o.build.error)}` : ""}</p>` : ""}${autoBuild && o.build?.state === "failed" && !o.build.kind ? `<form method="post" action="/orders/${esc(o.id)}/build"><button type="submit" class="btn sm">Build again</button></form>` : ""}
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
