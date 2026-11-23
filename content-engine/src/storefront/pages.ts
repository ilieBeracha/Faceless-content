/** Server-rendered pages. Every value that came from a person or a file goes through esc(). */
import type { Draft, User } from "./accounts.ts";
import type { BrandKit } from "./brand-kit.ts";
import type { CaptionsView, Dashboard, StoryboardView } from "./builder.ts";
import { HEBREW_RANGE } from "../render/font-faces.ts";
import { CAPTION_FONTS, PACES, type CaptionSettings, type Pace } from "../pipeline/storyboard.ts";
import type { Idea } from "../core/ideas.ts";
import { FRAME_PRESET_NAMES, FRAME_PRESETS, showsHost, type Frame, type Shot, type ThBeatVisual, type Theme } from "../skills/render-themed/schema.ts";
import { voiceTokens, type Script } from "../skills/write-script/schema.ts";
import { LANGUAGES } from "../core/languages.ts";
import { NO_HOST, OWN_HOST, OWN_LOOK, type Catalog } from "./catalog.ts";
import { HOST_FIELDS, HOST_RIGS, LOOK_CHOICES, MOODS, READY_RIG, hasHost, hasLook, hostFields, lookFields } from "./designer.ts";
import { INTAKE_FIELDS, MAX_ROUNDS, ORDER_STATUSES, OWN_DESIGN, SECTIONS, changeRequests, intakeLabel, intakeMax, intakeRequired, isBuilding, isMakingVideo, videoUnderWay, SUGGESTS_PER_DAY, TOPIC_MAX, type Intake, type Order, type SectionId } from "./store.ts";

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
.why{margin:8px 0 12px;font-size:15px;line-height:1.5;color:var(--ink);overflow-wrap:anywhere}.fact{margin:8px 0 0;font-size:14.5px;line-height:1.45;color:var(--ink)}.fact span{display:inline-block;font:600 12px/1 var(--body);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-right:8px}.fact .src{font-size:14px;color:var(--muted);white-space:nowrap}a.src{color:var(--accent)}
.rail a.create{background:var(--ink);color:var(--bg);font-weight:600;margin-bottom:10px}.rail a.create:hover,.rail a.create[aria-current]{background:var(--ink);color:var(--bg);opacity:.88}
.review{font-size:14px}.review summary{cursor:pointer;color:var(--warn);font-weight:600}.review ul{margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}.review p{margin:6px 0 0;font-size:13.5px}
.track.three{grid-template-columns:repeat(3,minmax(0,1fr));list-style:none;margin:0;padding:0}
.track.four{list-style:none;margin:0;padding:0}
.track li.now small{font-weight:600;color:var(--ink)}
@media(max-width:560px){.track{gap:5px}.track li{font-size:13px;padding-top:9px}.track li:not(.now) small{display:none}}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:0}.meta span{font:600 13px/1 var(--body);color:var(--muted);background:var(--soft);border-radius:99px;padding:7px 11px}
.script{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;align-self:stretch}
.script .line{background:var(--bg);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:9px;align-items:flex-start}
.num{font:700 12px/1 var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.script .line>p{margin:0;font:400 17px/1.5 var(--body);color:var(--ink);max-width:70ch}
.ost{font-size:13.5px;font-weight:600;color:var(--ink);background:var(--soft);border-radius:8px;padding:5px 9px;align-self:flex-start}
.script .claims,.claims.loose{list-style:none;padding:0;gap:8px;max-width:none;align-self:stretch}
.script .claims li,.claims.loose li{font-size:15px;line-height:1.45;border-left:3px solid var(--ok);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.claims .src{font-size:14px;color:var(--muted);overflow-wrap:anywhere}.claims a.src{color:var(--accent)}
.nofact{font-size:13.5px;color:var(--muted)}
.stick{position:sticky;bottom:10px;z-index:10;align-self:stretch;box-shadow:0 0 0 1px var(--line),0 10px 28px rgba(0,0,0,.16)}
.stick:has(details[open]){position:static;box-shadow:none}
.card.stick{padding:0}.stick .decide{width:100%}.stick.decide,.stick .decide{padding:10px 12px;gap:8px}.stick .btn{flex:1 1 auto;padding:13px 14px;font-size:15px}.stick details:not([open]){display:contents}
.wait .bar{width:100%;height:6px;border-radius:3px;background:var(--soft);overflow:hidden}
.wait .bar i{display:block;width:34%;height:100%;border-radius:3px;background:var(--accent);animation:wait 1.7s ease-in-out infinite}
@keyframes wait{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
@media(prefers-reduced-motion:reduce){.wait .bar i{animation:none;width:100%;opacity:.5}}
.pane{overflow-x:clip}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);border:0;padding:0}
.part{align-items:stretch;scroll-margin-top:130px}
.part .shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:12px;max-width:640px}
.part .shots figure{margin:0;display:flex;flex-direction:column;gap:6px;min-width:0}
.part .shots img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:12px;border:1px solid var(--line)}
.part figcaption{font-size:13.5px;line-height:1.4;color:var(--muted)}.part figcaption b{color:var(--ink);font-weight:600}
.edit>summary{list-style:none;cursor:pointer;display:inline-flex}.edit>summary::-webkit-details-marker{display:none}
.edit .inner{display:flex;flex-direction:column;gap:12px;padding-top:12px}
.edit.text{align-self:flex-start}.edit.text[open]{align-self:stretch}
.part .shots figure:has(details[open]),.part .shot.add[open]{grid-column:1/-1}
.part .shots figure:has(details[open]){display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px 12px;background:var(--bg);border-radius:14px;padding:10px}
.part .shots figure:has(details[open]) .edit{grid-column:1/-1}
.part .save{display:none;flex-wrap:wrap;gap:10px 14px;align-items:center;border-top:1px solid var(--line);padding-top:14px}
.part:has(details[open]) .save{display:flex}
.part .shot.add{border:2px dashed var(--line);border-radius:12px;padding:12px;align-self:start}.part .shot.add[open]{display:flex;flex-direction:column;gap:10px}
.seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;align-self:stretch}@media(max-width:560px){.seg{grid-template-columns:repeat(2,minmax(0,1fr))}}
.seg button{font:600 15px/1 var(--body);padding:13px 8px;border-radius:12px;border:0;cursor:pointer;background:var(--bg);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}
.seg button[aria-pressed=true]{background:var(--ink);color:var(--bg);box-shadow:none}
.part .shot.add summary{cursor:pointer;font-weight:600}
.part textarea{min-height:84px}
@media(min-width:700px){.stick .btn{flex:0 0 auto}}
label.check{display:flex;gap:8px;align-items:center;font-size:15px}
.caps{display:flex;flex-direction:column;gap:12px}.caps>button,.caps fieldset{align-self:flex-start}.caps .row3{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
.caps fieldset.hide{border:1px solid var(--line);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.caps input[type=color]{width:64px;height:40px;padding:2px}
form.own{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;width:100%}form.own label{flex:1 1 260px}
@media(max-width:820px){.shell{grid-template-columns:1fr}.rail{position:sticky;top:60px;z-index:15;height:auto;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line);background:var(--bg);padding:8px 12px;gap:4px}.rail a{flex:none;padding:9px 12px}.rail b{margin-left:4px}.cbar .mine{display:none}.pane{padding-top:22px}}
@media(max-width:480px){.cbar .sep,.cbar .brand span{display:none}}
.yours{display:flex;flex-wrap:wrap;gap:20px;align-items:center}.yours .vis{width:96px}.yours img.vis{aspect-ratio:1;object-fit:contain;background:var(--bg)}

/* a video under way: one step at a time inside the channel's page, its decision at the bottom; the site's own colours */
.fl{--edge:var(--line);--ok-soft:color-mix(in srgb,var(--ok) 14%,transparent);display:flex;flex-direction:column;gap:18px;max-width:640px;width:100%}.fl.wide{max-width:none}
.fl input[type=text],.fl textarea,.fl select,.sheet input[type=text],.sheet textarea,.sheet select{background:var(--surface);border:1.5px solid var(--line);border-radius:12px;font-size:16px}
.fl-top{display:flex;flex-direction:column;gap:8px}.fl-meta{align-self:flex-end;font:500 13.5px/1 var(--body);color:var(--muted);order:-1}
.fl-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;font:500 13px/1.2 var(--body);color:var(--muted)}
.fl-steps li{display:flex;flex-direction:column;gap:6px}.fl-steps li::before{content:"";height:4px;border-radius:2px;background:var(--line)}
.fl-steps li.done::before{background:var(--ink)}.fl-steps li[aria-current]{color:var(--ink);font-weight:600}.fl-steps li[aria-current]::before{background:var(--accent)}
.fl-main{display:flex;flex-direction:column;gap:16px;min-width:0}
.fl h2{font-size:20px}
.fl .sub{font-size:15px;line-height:1.45;color:var(--muted)}
.fl .head{display:flex;flex-direction:column;gap:8px;align-items:flex-start;justify-content:flex-start}
.fl .fl-bar>.go,.fl .fl-bar>form{flex:1 1 100%}
.pills{display:flex;flex-wrap:wrap;gap:6px}.pills span{font:600 12.5px/1 var(--body);padding:6px 10px;border-radius:99px;background:var(--surface);border:1px solid var(--line)}.pills .ok{background:var(--ok-soft);border-color:transparent;color:var(--ok)}
.fl .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.fl .card>*{max-width:100%}
.fl-bar{position:sticky;bottom:12px;z-index:10;display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:var(--lift)}
.fl-bar form,.fl-bar>.go{flex:1 1 100%}.fl-bar form{display:flex}
.fl .go{flex:1;min-height:52px;padding:0 18px;border-radius:99px;border:0;background:var(--accent);color:var(--on-accent);font:600 16px/1 var(--body);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.fl .go[disabled]{opacity:.45;cursor:not-allowed}
.fl .go.quiet{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--edge)}
.fl-bar .alt{order:1;font:500 14.5px/1 var(--body);padding:0 6px;min-height:40px;display:inline-flex;align-items:center;text-underline-offset:3px;white-space:nowrap}
.fl-bar small{flex:1;order:2;text-align:center;font-size:12.5px;color:var(--muted)}.fl-bar .alt+form+small{text-align:right}
.fl .line-btn{min-height:46px;padding:0 16px;border-radius:99px;border:1px solid var(--edge);background:var(--surface);color:var(--ink);font:600 15px/1 var(--body);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.own-topic{display:flex;flex-direction:column;gap:8px;font:600 13.5px/1.2 var(--body)}
.own-topic input{height:50px;border:1px solid var(--edge);border-radius:12px;padding:0 14px;font:400 16px/1 var(--body);background:var(--surface);color:var(--ink)}
.or{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--muted)}.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.picks{display:flex;flex-direction:column;gap:10px}
.idea-pick{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line);cursor:pointer}
.idea-pick:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.idea-pick input{flex:none;width:20px;height:20px;margin:1px 0 0;accent-color:var(--accent)}
.idea-pick>div{min-width:0}.idea-pick b{display:block;font-size:16px;line-height:1.3}.idea-pick small{display:block;font-size:14px;line-height:1.4;color:var(--muted);margin-top:4px}.idea-pick .fact{font-size:14px;margin-top:6px}
.more-ideas{align-self:center;font-size:14.5px;font-weight:500;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.what{display:flex;flex-direction:column;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;counter-reset:w}
.what li{display:flex;gap:12px;align-items:center;font-size:15px;line-height:1.35;counter-increment:w;color:var(--muted)}
.what li::before{content:counter(w);flex:none;width:26px;height:26px;border-radius:50%;background:var(--soft);display:grid;place-items:center;font:600 12.5px/1 var(--body)}
.what li:first-child{color:var(--ink);font-weight:600}.what li:first-child::before{background:var(--accent);color:var(--on-accent)}
.wait .bar{width:100%;height:6px;border-radius:3px;background:var(--soft);overflow:hidden}
.lines{display:flex;flex-direction:column;gap:8px}
.ln{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.ln[open]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.ln>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding:14px 16px}
.ln>summary::-webkit-details-marker{display:none}
.ln .n{font:600 13px/1.9 var(--body);color:var(--muted)}
.ln summary>div{display:flex;flex-direction:column;gap:7px;align-items:flex-start;min-width:0}
.ln .say{font-size:17px;line-height:1.45}
.fl .ost{font-size:12.5px;font-weight:600;background:none;border:1px solid var(--ink);border-radius:5px;padding:2px 7px}
.fl .proof{font-size:13.5px;line-height:1.4;color:var(--ok);font-weight:500}.fl .proof::before{content:"✓ "}
.fl .proof .src{color:var(--accent);font-weight:500;overflow-wrap:anywhere}.fl .proof small{display:block;color:var(--muted);font-weight:400}
.fix{display:flex;flex-direction:column;gap:10px;padding:0 16px 16px 48px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips form{display:contents}
.chip{min-height:38px;padding:0 13px;border-radius:99px;border:1px solid var(--edge);background:var(--surface);font:500 13.5px/1 var(--body);color:var(--ink);cursor:pointer}
.fix textarea{min-height:64px}
.fix .send{align-self:flex-start;min-height:40px;padding:0 16px;border-radius:99px;border:0;background:var(--ink);color:var(--bg);font:600 14px/1 var(--body);cursor:pointer}
@media(max-width:420px){.fix{padding-left:16px}}
.slides{display:flex;flex-direction:column}
.slide{display:none;flex-direction:column;gap:14px;scroll-margin-top:12px}
.slide:target,.slides:not(:has(.slide:target)) .slide:first-child{display:flex}
.shot{display:flex;gap:14px;align-items:stretch}
.big{position:relative;flex:none;width:46%;max-width:300px;border-radius:14px;overflow:hidden;background:var(--soft);align-self:flex-start}
.big img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover}
.big .pos{position:absolute;left:8px;top:8px;font:600 11px/1 var(--body);color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:99px}
.said{display:flex;flex-direction:column;gap:6px;min-width:0}
.said .k{font:600 11.5px/1 var(--body);letter-spacing:.05em;color:var(--muted);text-transform:uppercase;margin-top:8px}.said .k:first-child{margin-top:0}
.said p{font-size:15px;line-height:1.4}.said .see{font-size:13.5px;color:var(--muted)}
.step-nav{display:flex;gap:8px;margin-top:auto;padding-top:10px}
.step-nav a{width:44px;height:44px;border-radius:50%;border:1px solid var(--edge);background:var(--surface);display:grid;place-items:center;text-decoration:none;color:var(--ink);font-size:18px}
.step-nav span{width:44px}
.acts{display:flex;flex-wrap:wrap;gap:8px}
.acts>button,.acts>details>summary{min-height:44px;padding:0 8px;border-radius:12px;border:1px solid var(--edge);background:var(--surface);font:600 14px/1 var(--body);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;list-style:none;white-space:nowrap}
.acts>details>summary::-webkit-details-marker{display:none}
.acts>button,.acts>details{flex:1 1 0;min-width:0}
.acts>button[disabled]{opacity:.45;cursor:not-allowed}
.acts>details[open]{flex-basis:100%;order:2}.acts>details[open]>summary{border-color:var(--accent);color:var(--accent)}
.acts .inner{display:flex;flex-direction:column;gap:10px;padding-top:10px;align-items:flex-start}.acts .inner .f{align-self:stretch}
.acts .inner .send{min-height:40px;padding:0 16px;border-radius:99px;border:0;background:var(--ink);color:var(--bg);font:600 14px/1 var(--body);cursor:pointer}
.acts .inner .warn{background:none;border:0;padding:8px 0;color:var(--warn);font:600 14px/1 var(--body);cursor:pointer}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:6px}
.th{position:relative;display:block;border-radius:8px;overflow:hidden;background:var(--soft);text-decoration:none;color:var(--ink)}
.th img{display:block;width:100%;aspect-ratio:9/14;object-fit:cover}
.th span{position:absolute;left:4px;bottom:4px}.th b{font:700 11px/1 var(--body);color:#fff;background:rgba(0,0,0,.55);border-radius:4px;padding:2px 5px}.th small{display:none}
.strip-hint{font-size:12.5px;color:var(--muted);text-align:center}
.set .row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;width:100%;min-height:40px}
.set .row>span{font-size:14.5px;font-weight:600}.set .row>a{font-size:14.5px;font-weight:500;text-decoration:none;min-height:40px;display:inline-flex;align-items:center}
.speed{display:flex;background:var(--soft);border-radius:10px;padding:3px}
.speed button{min-height:34px;padding:0 9px;border:0;border-radius:8px;background:transparent;font:600 13px/1 var(--body);color:var(--muted);cursor:pointer}
.speed button[aria-pressed=true]{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.14)}
.right{display:contents}.fl .slides{order:1}.fl .strip{order:2}.fl .strip-hint{order:3}.fl .set{order:4}
@media(min-width:1100px){
.fl.wide .fl-main{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px 36px;align-items:start}
.fl.wide .head{grid-column:1/-1}
.fl.wide .right{display:flex;flex-direction:column;gap:16px;grid-column:2;grid-row:2}
.fl.wide .strip{grid-column:1;grid-row:2;grid-template-columns:1fr;gap:4px}
.fl.wide .strip-hint{display:none}
.fl.wide .th{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:center;padding:6px;background:none;border-radius:12px}
.fl.wide .th img{border-radius:6px;aspect-ratio:9/16}
.fl.wide .th span{position:static;display:flex;flex-direction:column;gap:3px;min-width:0}.fl.wide .th b{background:none;color:var(--muted);padding:0;font-size:12px}
.fl.wide .th small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;font-size:13.5px;line-height:1.35;color:var(--ink)}
.fl.wide .big{width:300px}.fl.wide .said p{font-size:16px}
}
.done-vid{display:flex;gap:16px;align-items:flex-end}
.done-vid video{flex:none;width:52%;max-width:260px;aspect-ratio:9/16;border-radius:16px;background:#000}
.done-vid p{font-size:13.5px;color:var(--muted)}
.btns{display:flex;flex-direction:column;gap:8px}.btns .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.btns .two:has(>:only-child){grid-template-columns:1fr}.btns form{display:flex}.btns form>button{flex:1}
.tips{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.tips>summary{list-style:none;display:flex;align-items:center;gap:10px;min-height:52px;padding:0 16px;font:600 15px/1.2 var(--body);cursor:pointer}
.tips>summary::-webkit-details-marker{display:none}.tips>summary svg{width:18px;height:18px;flex:none;color:var(--accent)}
.tips>summary::after{content:"›";margin-left:auto;font-size:20px;color:var(--muted);transition:transform .2s}.tips[open]>summary::after{transform:rotate(90deg)}
.tips ul{list-style:disc;padding:0 16px 14px 44px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.45;color:var(--ink)}
.next{background:var(--ink);color:var(--bg);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.next span{font-size:13px;opacity:.7}.next b{font-size:16px}.next form{display:flex}
.next button{min-height:42px;padding:0 16px;border-radius:99px;border:0;background:var(--bg);color:var(--ink);font:600 14px/1 var(--body);cursor:pointer}
.sheet{display:none;position:fixed;inset:0;z-index:40}.sheet:target{display:block}
.sheet .scrim{position:absolute;inset:0;background:rgba(23,22,27,.45)}
.sheet .in{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;max-height:90dvh;overflow-y:auto;background:var(--surface);border-radius:22px 22px 0 0;padding:20px 20px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
.sheet h2{font-size:22px;margin-bottom:12px}
.sheet .x{align-self:center;font:500 14.5px/1 var(--body);color:var(--muted);min-height:48px;display:inline-flex;align-items:center}
.sheet .inner{display:flex;flex-direction:column;gap:12px;padding:2px 0 16px;align-items:flex-start}.sheet .inner .f,.sheet .inner .caps{align-self:stretch}

/* orders */
.order{background:var(--surface);border-radius:24px;padding:24px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px 32px}
.order>div{display:flex;flex-direction:column;gap:10px;min-width:0}@media(max-width:760px){.order{grid-template-columns:1fr}}
.order select{flex:1;min-width:140px;padding:9px 12px}
code.link,pre.json{font:500 12.5px/1.5 ui-monospace,Menlo,monospace;word-break:break-all;user-select:all;background:var(--soft);padding:10px 12px;border-radius:12px;margin:0;white-space:pre-wrap}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn,.bar i{transition:none}}

/* the studio: an approved channel and My channels. Light, the videos first, one main action per screen; on a phone a tab bar */
body.studio{--bg:#f3f2ee;--surface:#fff;--ink:#15141a;--muted:#5c5b63;--line:#e2e0da;--soft:#ecebe6;--accent:var(--act,#15141a);--on-accent:#fff;--on-act:#fff;--pop:#ffcf33;--on-pop:#15141a;--ok:#1f6b45;--warn:#8a4b00;--bad:#9b1c1c;--busy:#1e4fa0;--lift:0 18px 40px -22px rgba(21,20,26,.35);--display:"Space Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light;background:var(--bg);color:var(--ink)}
.sbar{position:sticky;top:0;z-index:30;background:var(--surface);border-bottom:1px solid var(--line)}
.sbar .in{max-width:1240px;margin:0 auto;padding:10px clamp(16px,3vw,32px);display:flex;align-items:center;gap:12px;min-height:64px}
.sbar .brand{font:700 18px/1 var(--display)}.sbar .sep{color:var(--line);font-size:20px}.sbar .grow,.hd .grow,.hd2 .grow{flex:1}
.sbar form{display:flex}.sbar .who{font-size:14px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.switch{display:inline-flex;align-items:center;gap:8px;font:600 15px/1.2 var(--body);padding:9px 12px;border:1px solid var(--line);border-radius:10px;text-decoration:none;min-width:0;max-width:260px}
.switch span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.switch svg{width:14px;height:14px;flex:none}
.stab{display:flex;gap:4px;margin-left:6px}
.stab a{font:500 15px/1 var(--body);padding:11px 14px;border-radius:10px;text-decoration:none;color:var(--muted);white-space:nowrap}
.stab a:hover{color:var(--ink);background:var(--soft)}.stab a[aria-current]{color:var(--ink);background:var(--soft);font-weight:600}
.act{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 15px/1 var(--body);padding:13px 18px;min-height:46px;border-radius:12px;border:0;background:var(--act,#15141a);color:var(--on-act);text-decoration:none;cursor:pointer;white-space:nowrap}
.act svg{width:16px;height:16px;flex:none}.act:hover{filter:brightness(1.08)}
.act.dark{background:var(--ink);color:#fff}.act.line{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px #cfcdc6}.act.line:hover{filter:none;background:var(--soft)}
.act.sm{padding:10px 14px;min-height:40px;font-size:14.5px}.act[disabled]{opacity:.45;cursor:not-allowed;filter:none}
.quiet{font:600 14.5px/1 var(--body);color:var(--muted);background:none;border:0;padding:10px 8px;min-height:40px;cursor:pointer}.quiet:hover{color:var(--ink)}
.mtabs{display:none}
.spage{max-width:1240px;margin:0 auto;padding:36px clamp(16px,3vw,32px) 88px;display:flex;flex-direction:column;gap:40px}
.spage h1{font:700 clamp(30px,4.4vw,46px)/1.05 var(--display);letter-spacing:-.02em}
.spage h2{font:700 26px/1.1 var(--display);letter-spacing:-.01em}.spage h2.h3,.panel h2{font-size:19px}
.kicker{font:600 13px/1 var(--body)!important;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.sec{display:flex;flex-direction:column;gap:16px}
.hd,.hd2{display:flex;align-items:baseline;gap:8px 12px;flex-wrap:wrap}.hd2{align-items:center}
.hd small{font-size:15px;color:var(--muted)}.hd a{font-size:15px;font-weight:600}
.chead{display:flex;flex-wrap:wrap;align-items:center;gap:18px 20px}
.chead .cover{width:84px;height:84px;border-radius:22px;object-fit:cover;flex:none;background:var(--soft)}
.chead>div:not(.tags){flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:6px}.chead p{color:var(--muted);font-size:17px;max-width:62ch}
.tags{display:flex;flex-wrap:wrap;gap:8px}
.tag{display:inline-flex;align-items:center;gap:6px;font:600 13px/1 var(--body);padding:7px 11px;border-radius:99px;background:var(--surface);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line);white-space:nowrap}
.tag i{width:7px;height:7px;border-radius:50%;background:currentColor}
.tag.ok{background:#e3f1e8;color:var(--ok);box-shadow:none}.tag.warn{background:#fbebd3;color:var(--warn);box-shadow:none}.tag.busy{background:#e4ecfa;color:var(--busy);box-shadow:none}.tag.bad{background:#f7e1e1;color:var(--bad);box-shadow:none}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;min-width:0}.panel>*{max-width:100%}.panel .hd2{align-self:stretch}
.panel form.own,.icard form.own{align-items:flex-end}
.needs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px}
.need{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px 18px;display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center}
.need>div{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.need b{font-size:17px;line-height:1.3}.need p{font-size:14.5px;color:var(--muted)}.need form{display:flex}.need .why{margin:0}
.need .what-k{font:600 13.5px/1.2 var(--body)}.need.warn .what-k{color:var(--warn)}.need.busy .what-k{color:var(--busy)}.need.bad .what-k{color:var(--bad)}
.need.wait .bar{align-self:stretch;width:auto}.need.wait .bar i{background:var(--busy)}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:24px 20px}
.vt{display:flex;flex-direction:column;gap:8px;text-decoration:none;min-width:0}
.vt .pic{position:relative;display:block;border-radius:16px;overflow:hidden;background:#15141a;aspect-ratio:9/16}
.vt .pic img,.vt .pic video{width:100%;height:100%;object-fit:cover;display:block}
.vt .pic .tag{position:absolute;left:10px;top:10px}
.vt .len{position:absolute;right:10px;bottom:10px;font:600 12px/1 var(--body);padding:5px 8px;border-radius:8px;background:rgba(21,20,26,.85);color:#fff}
.vt b{font-size:16px;line-height:1.3}.vt small{font-size:14px;color:var(--muted);margin-top:-4px}.vt:hover b{text-decoration:underline}
.vt.add .pic{background:none;border:2px dashed #cfcdc6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted);font-weight:600}.vt.add svg{width:28px;height:28px}
.icards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:14px}
.icard{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.icard>div:first-child{flex:1}.icard b{display:block;font-size:17px;line-height:1.3}.icard small{display:block;font-size:14.5px;color:var(--muted);line-height:1.5;margin-top:4px}
.icard .do{display:flex;gap:4px;align-items:center}.icard .do form{display:flex}
.icard.ask{background:var(--ink);color:#fff;border:0}.icard.ask label.f small,.icard.ask p{color:#c9c8cf}
.icard.ask input[type=text]{background:#24232a;color:#fff;border-color:#3a3940}.icard.ask .act{background:#fff;color:var(--ink)}
.back{display:inline-flex;align-items:center;gap:6px;font:600 15px/1 var(--body);text-decoration:none;color:var(--muted);align-self:flex-start;min-height:40px;margin-bottom:-20px}.back svg{width:18px;height:18px}
.vpage{display:flex;flex-wrap:wrap;gap:40px 48px;align-items:flex-start}
.vpage .player{flex:0 1 380px;min-width:260px;display:flex;flex-direction:column;gap:10px}
.vpage video{width:100%;aspect-ratio:9/16;border-radius:22px;background:#000;display:block}.vpage .live{position:relative;border-radius:22px;overflow:hidden}#cap-layer{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}.vpage .player small{text-align:center;color:var(--muted);font-size:14px}
.vpage .side2{flex:1 1 460px;min-width:0;display:flex;flex-direction:column;gap:26px}.vpage .side2>.sec{align-items:flex-start}
.row2{display:flex;flex-wrap:wrap;gap:10px}
.cap{align-self:stretch}.cap p{font-size:16px;line-height:1.55}.cap .hash{color:var(--busy);font-size:15px}
.tips2{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;align-self:stretch}
.tip{display:flex;gap:12px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:13px 15px;font-size:15px;line-height:1.5}.tip svg{width:19px;height:19px;flex:none;margin-top:2px;color:var(--warn)}
details.more2{align-self:stretch}details.more2>summary{cursor:pointer;font:600 15px/1 var(--body);padding:10px 0;text-decoration:underline;text-underline-offset:3px}details.more2[open]>summary{margin-bottom:8px}
.change{border-top:1px solid var(--line);padding-top:24px}
.look{display:flex;flex-wrap:wrap;gap:32px 44px;align-items:flex-start}
.look .prev{flex:0 1 300px;min-width:220px;border-radius:28px;overflow:hidden;border:8px solid var(--ink);background:#000;aspect-ratio:9/16;position:sticky;top:96px}
.look .prev img,.look .prev video{width:100%;height:100%;object-fit:cover;display:block}
.look .cols{flex:1 1 480px;min-width:0;display:flex;flex-direction:column;gap:16px}
.big-name{font:700 22px/1.2 var(--display)}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;align-self:stretch}.sws div{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}.sws i{display:block;height:44px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line)}
.chgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:18px}
.ch{background:var(--surface);border:1px solid var(--line);border-radius:22px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;min-width:0}
.ch .strip3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;background:var(--line);aspect-ratio:27/13}
.ch .strip3 img{width:100%;height:100%;object-fit:cover;display:block}.ch .strip3 span{background:var(--soft)}
.ch .empty{aspect-ratio:27/13;background:var(--soft);display:grid;place-items:center;color:var(--muted);font-size:14px}
.ch .info{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.ch .t{display:flex;align-items:center;gap:8px}.ch .t b{flex:1;font-size:18px;line-height:1.25;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch small{font-size:14px;color:var(--muted);display:flex;align-items:center;gap:8px}.dots{display:inline-flex}.dots i{width:14px;height:14px;border-radius:50%;margin-left:-4px;box-shadow:0 0 0 2px var(--surface)}.dots i:first-child{margin-left:0}.ch:hover b{text-decoration:underline}
body.studio .fl{margin:0 auto}body.studio .fl h1{font-size:clamp(30px,5vw,44px)}
@media(max-width:760px){
.stab,.sbar .new,.sbar .sep,.sbar .brand span,.sbar .who{display:none}
.spage{padding-top:22px;gap:30px}.spage.tabbed{padding-bottom:116px}
.mtabs{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--surface);border-top:1px solid var(--line);justify-content:space-around;align-items:center;padding:8px 6px calc(8px + env(safe-area-inset-bottom))}
.mtabs a{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:58px;padding:4px;font:500 11px/1.2 var(--body);text-decoration:none;color:var(--muted)}
.mtabs a[aria-current]{color:var(--ink);font-weight:600}.mtabs svg{width:24px;height:24px}
.mtabs a.plus{min-width:0;width:56px;height:46px;border-radius:16px;background:var(--act,#15141a);color:var(--on-act);justify-content:center;padding:0}
.vgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 12px}
.vpage{gap:22px}.vpage .player{flex-basis:100%}
.look .prev{flex-basis:100%;aspect-ratio:16/10;border-width:0;border-radius:18px;position:static}
.chead .cover{width:56px;height:56px;border-radius:16px}
.back{margin-bottom:-10px}
}
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
<div class="progress"><p class="label" data-count>Step 1 of 4</p><div class="bar"><i></i></div></div>${any}
<fieldset class="step"><legend>What is it about?</legend>
${field("idea", values, errors, "area", "One or two sentences. What is every video about?", "Surprising facts about the technology we use every day")}
${field("audience", values, errors, "text", "Who watches, and roughly how old they are.", "Curious teens and adults")}
<label class="f" for="language">Language of the videos <small>What the voice speaks and the captions say. Hebrew is read right to left.</small><select id="language" name="language">${LANGUAGES.map((l) => `<option value="${l.code}"${(values.language ?? "en") === l.code ? " selected" : ""}>${esc(l.native === l.name ? l.name : `${l.name} · ${l.native}`)}</option>`).join("")}</select></label>${errors.language ? `<p class="error" role="alert">${esc(errors.language)}</p>` : ""}</fieldset>
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

/** The fact-check, for the customer: the script part by part, each fact under the line that states it with its source, and the decision. */
function factsHtml(order: Order, script: Script, first = true): string {
  const base = `/w/${esc(order.token)}`;
  const fact = (c: Script["claims"][number]) => `<li>${esc(c.claim)}${factSource(c.source)}${c.note ? `<small>${esc(c.note)}</small>` : ""}</li>`;
  const ids = new Set(script.beats.map((b) => b.id));
  const loose = script.claims.filter((c) => !ids.has(c.beat));
  const part = (b: Script["beats"][number], i: number) => {
    const mine = script.claims.filter((c) => c.beat === b.id);
    return `<li class="line"><span class="num">Part ${i + 1}</span><p>${esc(b.voiceover)}</p>${mine.length ? `<ul class="claims">${mine.map(fact).join("")}</ul>` : `<small class="nofact">No fact is listed for this part</small>`}</li>`;
  };
  const n = script.claims.length;
  const left = MAX_ROUNDS - (order.video?.rounds ?? 0);
  const change =
    left > 0
      ? `<details><summary class="btn ghost">Ask for a change</summary><form method="post" action="${base}/facts"><input type="hidden" name="decision" value="change"><div class="inner"><label class="f" for="facts-note">Which fact is wrong, and what should change?<textarea id="facts-note" name="note" maxlength="600" required></textarea></label><div class="row"><button type="submit" class="btn sm">Send request</button><button type="button" class="text" data-close>Cancel</button></div><small class="muted">The script is written again and comes back here. Rewrite ${MAX_ROUNDS - left + 1} of ${MAX_ROUNDS}.</small></div></form></details>`
      : `<p class="muted">This script has been rewritten ${MAX_ROUNDS} times. Further changes are made by hand: quote <b>${esc(order.id)}</b> if you contact us.</p>`;
  return `<section class="notice" id="facts"><h2>Check the facts</h2><p class="muted">The script for your ${first ? "first " : ""}video, “${esc(script.title)}”, is written. Nothing is voiced or drawn until you approve it.</p>
<p class="meta"><span>${script.beats.length} parts</span><span>${n} fact${n === 1 ? "" : "s"} to check</span></p>
${angleHtml(script)}<ol class="script">${script.beats.map(part).join("")}</ol>
${loose.length ? `<h3>More facts</h3><ul class="claims loose">${loose.map(fact).join("")}</ul>` : ""}
<p class="muted">Each fact stands under the line that states it. If a line states a fact that is not listed, ask for a change. Approving starts the video: it is made exactly from these words.</p></section>
<div class="decide stick" role="group" aria-label="Your decision on the facts"><form method="post" action="${base}/facts"><input type="hidden" name="decision" value="approve"><button type="submit" class="btn yes">Approve the facts</button></form>${change}</div>`;
}
/** The channel's accent colour (the default caption highlight). */
function accentOf(kit: BrandKit): string {
  const accent = kit.colours.find((c) => c.name === "Accent");
  if (!accent) throw new Error(`The brand kit of "${kit.name}" has no accent colour.`);
  return accent.hex;
}

/** The channel's point of view: what every video argues and what a viewer gets from it (absent on channels from before them). */
function pointHtml(kit: { belief: string; gets: string }): string {
  return [kit.belief ? `<p><b>What every video argues:</b> ${esc(kit.belief)}</p>` : "", kit.gets ? `<p><b>What a viewer gets:</b> ${esc(kit.gets)}</p>` : ""].join("");
}

const CAPTION_SIZE_NAMES: Record<CaptionSettings["size"], string> = { small: "Small", medium: "Medium", large: "Large" };
const PACE_NAMES: Record<Pace, string> = { slower: "Slower", normal: "Normal", faster: "Faster", fastest: "Fastest" };
const CAPTION_PLACE_NAMES: Record<CaptionSettings["place"], string> = { bottom: "Bottom", middle: "Middle" };

/**
 * The caption settings form. `accent` and `font`: the channel's, used when the settings choose none. `beats`: the video's
 * parts, to switch captions off on some (absent for the channel's defaults). `id`: for the live captions script.
 */
function captionsForm(action: string, c: CaptionSettings, accent: string, font: string, beats: Script["beats"] | null, submit: string, id = ""): string {
  const select = (name: string, value: string, options: [string, string][]) =>
    `<select name="${name}" id="cap-${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const hide = beats
    ? `<fieldset class="hide"><legend>No captions on these parts</legend>${beats.map((b, i) => `<label class="check"><input type="checkbox" name="hide_${esc(b.id)}"${c.hide_beats.includes(b.id) ? " checked" : ""}> Part ${i + 1}: “${esc(b.voiceover.split(/\s+/).slice(0, 6).join(" "))}…”</label>`).join("")}</fieldset>`
    : "";
  return `<form class="caps" method="post" action="${action}"${id ? ` id="${id}"` : ""}>
<label class="check"><input type="checkbox" name="show"${c.show ? " checked" : ""}> Draw captions into the video</label>
<p class="muted" style="font-size:14px;margin:0">Either way, every video comes with its captions as a file (.srt) to lay over it yourself.</p>
<div class="row3"><label class="f" for="cap-size">Size${select("size", c.size, Object.entries(CAPTION_SIZE_NAMES))}</label><label class="f" for="cap-place">Where${select("place", c.place, Object.entries(CAPTION_PLACE_NAMES))}</label><label class="f" for="cap-case">Letters${select("case", c.case, [["normal", "As written"], ["upper", "ALL CAPS"]])}</label></div>
<div class="row3"><label class="f" for="cap-font">Font${select("font", c.font ?? font, Object.entries(CAPTION_FONTS))}</label><label class="f" for="cap-text">Words<input type="color" id="cap-text" name="text_color" value="${esc(c.text_color ?? "#ffffff")}"></label></div>
<div class="row3"><label class="check"><input type="checkbox" name="own_color"${c.color ? " checked" : ""}> My own highlight colour</label><label class="f" for="cap-color">Highlight<input type="color" id="cap-color" name="color" value="${esc(c.color ?? accent)}"></label></div>
${hide}<button type="submit" class="btn ghost sm">${esc(submit)}</button></form>`;
}

/**
 * A finished video's captions step: its clean render plays with the captions drawn over it live (captions-live.js)
 * as the form is changed; Save draws them into the video to download.
 */
function captionsStep(base: string, episode: string, caps: CaptionsView, kit: BrandKit): string {
  const status =
    caps.restyle?.state === "working"
      ? `<p class="notice" role="status">Putting your saved captions into the video. It takes about a minute: refresh the page to download it. Until then the download has the captions it had.</p>`
      : caps.restyle?.state === "failed"
        ? `<p class="error" role="alert">Your saved captions could not be put into the video (${esc(caps.restyle.error ?? "")}). The download has the captions it had. Save again to try once more.</p>`
        : "";
  const faces = Object.keys(caps.live.fonts)
    .map((k) => `@font-face{font-family:"cap-${k}";font-weight:${caps.live.fonts[k].weight};src:url(/assets/font/cap/${k}.woff2) format("woff2");font-display:block}@font-face{font-family:"cap-${k}";font-weight:${caps.live.fonts[k].weight};src:url(/assets/font/cap/${k}-he.woff2) format("woff2");unicode-range:${HEBREW_RANGE};font-display:block}`)
    .join("");
  return `<section class="panel" id="captions" style="gap:12px"><h2 class="h3">Captions</h2><p class="muted">Change how they look and watch it on the video as it plays. Save puts them into the video you download: about a minute, and nothing else is made again.</p>${status}
${captionsForm(`${base}/video/${esc(episode)}/captions`, caps.settings, caps.live.accent, kit.font, caps.beats, "Save captions", "cap-form")}
<style>${faces}</style><script type="application/json" id="cap-data">${JSON.stringify(caps.live).replace(/</g, "\\u003c")}</script>${tag("captions-live")}</section>`;
}

/** Why a stopped video stopped, in a sentence the customer can act on; the engine's own words when no plainer ones fit. */
export function failureReason(error: string): string {
  if (/spending cap|exceeded its monthly/i.test(error)) return "The picture service refused the request: its monthly spending limit is reached. Raise the limit in the Google AI project, then try again.";
  if (/FAL_KEY|fal (GET|POST)/i.test(error)) return `The voice service did not answer as expected. ${error}`;
  if (/^QA failed/.test(error)) return `The finished video did not pass a check that must pass:${error.replace(/^QA failed.*?qa-report\.md/, "").replace(/\s*Fix what it lists.*$/, "").replace(/\s+- /g, " ")}`;
  if (/validation errors/i.test(error)) return "The channel's own files have a problem, so no video can be made until it is fixed on our side.";
  return error;
}

/** A stopped video: the step it stopped at, why, and the way on. Nothing made so far is lost, so it continues from that step. */
function failureHtml(order: Order): string {
  const v = order.video!;
  const reason = failureReason(v.error ?? "No reason was recorded.");
  return `<p class="muted">It stopped while it was being ${v.failed_at === "making" ? "made (painted, voiced, rendered or checked)" : "written"}. Nothing made so far is lost.</p><p class="why"><b>Why:</b> ${esc(reason.length > 600 ? `${reason.slice(0, 600)}…` : reason)}</p><form method="post" action="/w/${esc(order.token)}/retry"><button type="submit" class="btn sm">Try again from that step</button></form><small class="muted">Quote <b>${esc(order.id)}</b> if you contact us about it.</small>`;
}

/** One step of a video under way, shown on a page of its own. `bar`: its decision, kept in reach at the bottom. `sheets`: what slides over the page. `wide`: room for the shots beside the picture on a large screen. */
interface FlowStep {
  meta: string;
  head: string;
  body: string;
  bar: string;
  sheets: string;
  wide?: boolean;
}

/** A sheet over the page, shown while it is the address's target (no script). `back`: the element closing it returns to. `form`: its attributes, when the whole sheet is one form. */
function sheet(id: string, back: string, label: string, inner: string, form = ""): string {
  const el = form ? "form" : "div";
  return `<div class="sheet" id="${esc(id)}"><a class="scrim" href="#${esc(back)}" aria-label="Close"></a><${el}${form ? ` ${form}` : ""} class="in" role="dialog" aria-label="${esc(label)}">${inner}<a class="x" href="#${esc(back)}">Close</a></${el}></div>`;
}

/** A step that runs by itself: what is happening, what comes after it, and that nothing is needed meanwhile. `what`: the work in order, the first being done now. */
function waitStep(title: string, text: string, what: string[]): FlowStep {
  return {
    meta: "",
    head: `<div class="head"><h1>${esc(title)}</h1><p class="sub">${esc(text)}</p></div>`,
    body: `<div class="wait" role="status"><div class="bar" aria-hidden="true"><i></i></div></div><ol class="what">${what.map((w) => `<li>${esc(w)}</li>`).join("")}</ol>`,
    bar: "",
    sheets: "",
  };
}

/** The quick changes offered under a line of the script, each sent as the note for that line. */
const LINE_FIXES: [string, string][] = [
  ["Shorter", "Make this line shorter."],
  ["Simpler words", "Say this line in simpler words."],
  ["This fact is wrong", "The fact in this line is wrong: check it and fix it, or cut it."],
];

/** What a script argues and what the viewer leaves with (scripts from before angles have none). */
function angleHtml(script: Script): string {
  const a = script.angle;
  return a ? `<div class="panel angle"><p><b>The point:</b> ${esc(a.point)}</p><p><b>Who has something at stake:</b> ${esc(a.stakes)}</p><p><b>The turn:</b> ${esc(a.turn)}</p><p><b>What the viewer leaves with:</b> ${esc(a.takeaway)}</p></div>` : "";
}

/** The script step: the script line by line, each fact under the line that states it with its source. A line opens to change just that line. */
function scriptStep(order: Order, script: Script, boards: boolean): FlowStep {
  const base = `/w/${esc(order.token)}`;
  const fact = (c: Script["claims"][number]) => `<p class="proof">${esc(c.claim)} ${factSource(c.source)}${c.note ? `<small>${esc(c.note)}</small>` : ""}</p>`;
  const ids = new Set(script.beats.map((b) => b.id));
  const loose = script.claims.filter((c) => !ids.has(c.beat));
  const left = MAX_ROUNDS - (order.video?.rounds ?? 0);
  const send = (n: number, inner: string) => `<form method="post" action="${base}/facts"><input type="hidden" name="decision" value="change"><input type="hidden" name="line" value="${n}">${inner}</form>`;
  const fix = (n: number) =>
    left > 0
      ? `<div class="fix"><div class="chips">${LINE_FIXES.map(([label, note]) => send(n, `<input type="hidden" name="note" value="${esc(note)}"><button type="submit" class="chip">${esc(label)}</button>`)).join("")}</div>${send(n, `<label class="f" for="line-${n}">Or say what to change<textarea id="line-${n}" name="note" maxlength="600" required></textarea></label><button type="submit" class="send">Rewrite this line</button>`)}</div>`
      : "";
  const line = (b: Script["beats"][number], i: number) =>
    `<li><details class="ln"><summary><span class="n">${i + 1}</span><div><p class="say">${esc(b.voiceover)}</p>${script.claims
      .filter((c) => c.beat === b.id)
      .map(fact)
      .join("")}</div></summary>${fix(i + 1)}</details></li>`;
  const n = script.claims.length;
  const change =
    left > 0
      ? sheet(
          "change",
          "bar",
          "Change the whole script",
          `<input type="hidden" name="decision" value="change"><h2>Change the whole script</h2><div class="inner"><label class="f" for="facts-note">What should change?<textarea id="facts-note" name="note" maxlength="600" required></textarea></label><button type="submit" class="btn">Send request</button><small class="muted">The script is written again and comes back here. Rewrite ${MAX_ROUNDS - left + 1} of ${MAX_ROUNDS}.</small></div>`,
          `method="post" action="${base}/facts"`,
        )
      : "";
  return {
    meta: "",
    head: `<div class="head"><h1>${esc(script.title)}</h1><div class="pills"><span>${script.beats.length} lines</span><span class="ok">${n} fact${n === 1 ? "" : "s"}, each with its source</span></div>${left > 0 ? `<p class="sub">Tap a line to change it.</p>` : ""}</div>`,
    body: `${angleHtml(script)}<ol class="lines">${script.beats.map(line).join("")}</ol>
${loose.length ? `<h2>More facts</h2>${loose.map(fact).join("")}` : ""}
${left > 0 ? "" : `<p class="sub">This script has been rewritten ${MAX_ROUNDS} times. Further changes are made by hand: quote <b>${esc(order.id)}</b> if you contact us.</p>`}`,
    bar: `${left > 0 ? `<a class="alt" href="#change">Change all of it</a>` : ""}<form method="post" action="${base}/facts"><input type="hidden" name="decision" value="approve"><button type="submit" class="go">${boards ? "Looks right · paint the pictures" : "Looks right · make the video"}</button></form>`,
    sheets: change,
  };
}

/** The pictures step (the storyboard): one shot at a time at the size it is watched, its line beside it and its changes under it; every shot in a strip to jump to. Speed for the whole video below. No script: the shot shown is the address's target. */
function picturesStep(order: Order, sb: StoryboardView, accent: string): FlowStep {
  const base = `/w/${esc(order.token)}`;
  const shotsOf = (b: Script["beats"][number]) => ((b.visual as ThBeatVisual).shots ?? []) as Shot[];
  const src = (id: string) => `${base}/shot/${esc(id)}?v=${esc(sb.pictures[id] ?? "")}`;
  const all = sb.script.beats.flatMap((b, i) => shotsOf(b).map((s, k) => ({ b, i, s, n: k + 1, id: `${b.id}-${k + 1}` })));
  // Each shot is a form for its part: the part's other shots travel along unchanged.
  const slide = ({ b, i, s, n, id }: (typeof all)[number], at: number) => {
    const shots = shotsOf(b);
    const words = voiceTokens(b.voiceover);
    const cut = (k: number, chosen: string | undefined) =>
      `<label class="f" for="at-${esc(id)}-${k}">Cuts in on the word<select id="at-${esc(id)}-${k}" name="at_${k}"><option value="">Choose…</option>${words.map((w) => `<option value="${esc(w)}"${w === chosen ? " selected" : ""}>${esc(w)}</option>`).join("")}</select></label>`;
    const host = (k: number, on: boolean) => (sb.hostOnScreen ? `<label class="check"><input type="checkbox" name="host_${k}"${on ? " checked" : ""}> The host is in this picture</label>` : "");
    const others = shots
      .map((o, k) => (k + 1 === n ? "" : `<input type="hidden" name="show_${k + 1}" value="${esc(o.show)}">${showsHost(o) ? `<input type="hidden" name="host_${k + 1}" value="on">` : ""}${o.at ? `<input type="hidden" name="at_${k + 1}" value="${esc(o.at)}">` : ""}`))
      .join("");
    const next = shots.length + 1;
    const add =
      n === shots.length && next <= 3
        ? `<label class="f" for="show-${esc(id)}-add">Add a picture after this one <small>What it shows. Leave it empty to add none.</small><textarea id="show-${esc(id)}-add" name="show_${next}" maxlength="500" placeholder="Close-up of …"></textarea></label>${host(next, false)}${cut(next, undefined)}<button type="submit" class="send">Add and paint it</button>`
        : "";
    const more = add || shots.length > 1 ? `<details><summary>More</summary><div class="inner">${add}${shots.length > 1 ? `<button type="submit" name="remove_${n}" value="on" class="warn">Remove this picture</button>` : ""}</div></details>` : "";
    const prev = all[at - 1];
    const after = all[at + 1];
    return `<form class="slide" id="s-${esc(id)}" method="post" action="${base}/storyboard/beat"><input type="hidden" name="beat" value="${esc(b.id)}"><button type="submit" class="vh" tabindex="-1" aria-hidden="true"></button>${others}
<div class="shot"><div class="big"><img src="${src(id)}" alt="${esc(s.show)}"><span class="pos">Shot ${at + 1} of ${all.length}</span></div><div class="said"><p class="k">Said over it</p><p>“${esc(b.voiceover)}”</p><p class="k">We see</p><p class="see">${s.at ? `From “${esc(s.at)}”: ` : ""}${esc(s.show)}</p><div class="step-nav">${prev ? `<a href="#s-${esc(prev.id)}" aria-label="Previous shot">‹</a>` : `<span></span>`}${after ? `<a href="#s-${esc(after.id)}" aria-label="Next shot">›</a>` : ""}</div></div></div>
<div class="acts"><button type="submit" name="repaint" value="${n}"${sb.repaintsLeft ? "" : ' disabled title="No repaints left for this video"'}>Repaint</button><details><summary>Describe</summary><div class="inner"><label class="f" for="show-${esc(id)}">What we see<textarea id="show-${esc(id)}" name="show_${n}" minlength="10" maxlength="500" required>${esc(s.show)}</textarea></label>${host(n, showsHost(s))}${n > 1 ? cut(n, s.at) : ""}<button type="submit" class="send">Paint from this</button></div></details>${more}</div></form>`;
  };
  // The shot shown is marked in the strip (the first when none is chosen).
  const mark = `<style>${all.map((x) => `.fl:has(#s-${x.id}:target) #t-${x.id}`).join(",")}${all.length ? `,.fl:not(:has(.slide:target)) #t-${all[0]!.id}` : ""}{box-shadow:0 0 0 3px var(--accent);background:var(--surface)}</style>`;
  // Captions are set on the finished video, where they are seen live over it.
  const settings = `<section class="card set" id="set"><div class="row"><span>Voice speed</span><form class="speed" method="post" action="${base}/storyboard/speed" role="group" aria-label="Voice speed">${PACES.map((p) => `<button type="submit" name="pace" value="${p}" aria-pressed="${p === sb.pace}">${PACE_NAMES[p]}</button>`).join("")}</form></div></section>`;
  const bar = sb.revising
    ? sb.changed
      ? `<form method="post" action="${base}/storyboard/approve"><button type="submit" class="go">Make the new version</button></form><small>Keeps the same words and does not use up one of today's videos</small>`
      : `<form method="post" action="${base}/storyboard/cancel"><button type="submit" class="go quiet">Leave it as it is</button></form>`
    : `<form method="post" action="${base}/storyboard/approve"><button type="submit" class="go">Make the video</button></form>`;
  const sub = sb.revising
    ? `“${esc(sb.script.title)}” is finished. Change a picture or the speed (captions are changed on the video itself). ${sb.changed ? "The new version takes a few minutes." : "Nothing is changed yet."} The video you have now is kept as an earlier version.`
    : "";
  return {
    meta: `${sb.repaintsLeft} repaint${sb.repaintsLeft === 1 ? "" : "s"} left`,
    head: `<div class="head"><h1>${all.length} picture${all.length === 1 ? "" : "s"}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>`,
    body: `${mark}<nav class="strip" aria-label="Shots in order">${all.map((x, k) => `<a class="th" id="t-${esc(x.id)}" href="#s-${esc(x.id)}"><img src="${src(x.id)}" alt="" loading="lazy"><span><b>${k + 1}</b><small>${esc(x.b.voiceover)}</small></span></a>`).join("")}</nav><div class="right"><div class="slides">${all.map(slide).join("")}</div>${settings}</div>`,
    bar,
    sheets: "",
    wide: true,
  };
}

/** The last step: the finished video, what to do with it, and the next one. */
function readyStep(base: string, e: BrandKit["episodes"][number], next: Idea | undefined, pick: string, busy: boolean): FlowStep {
  const revise = e.revisable ? `<form method="post" action="${base}/revise-video"><input type="hidden" name="episode" value="${esc(e.id)}"><button type="submit" class="line-btn"${busy ? ' disabled title="A video is under way"' : ""}>Change something</button></form>` : "";
  const tips = e.review.length
    ? `<details class="tips"><summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>${e.review.length} tip${e.review.length === 1 ? "" : "s"} for the next video</summary><ul>${e.review.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`
    : "";
  const up = next
    ? `<div class="next"><span>Up next</span><b>${esc(next.title)}</b><form method="post" action="${base}/make"><input type="hidden" name="idea" value="${esc(next.id)}"><button type="submit">Make it next</button></form></div>`
    : "";
  return {
    meta: "",
    head: `<div class="head"><h1>Your new video is ready</h1></div>`,
    body: `<div class="done-vid"><video controls playsinline preload="metadata" src="${base}/video/${esc(e.id)}?r=${e.versions.length}"></video><div class="head"><h2>${esc(e.title)}</h2></div></div>
<div class="btns"><a class="go" href="${base}/video/${esc(e.id)}?download=1">Download the video</a>${e.captions_file ? `<a class="line-btn" href="${base}/captions/${esc(e.id)}">Download captions (.srt)</a>` : ""}<div class="two">${revise}<a class="line-btn" href="${pick}">Pick a new topic</a></div></div>${tips}${up}`,
    bar: "",
    sheets: "",
  };
}

/** A video under way, inside the channel's page: the steps, this step, and its decision kept in reach at the bottom. `at`: the step's place in `names`. */
function flowHtml(names: string[], at: number, step: FlowStep): string {
  return `<div class="fl${step.wide ? " wide" : ""}"><div class="fl-top"><ol class="fl-steps" aria-label="Steps">${names.map((name, i) => `<li${i < at ? ' class="done"' : ""}${i === at ? ' aria-current="step"' : ""}>${esc(name)}</li>`).join("")}</ol>${step.meta ? `<span class="fl-meta">${esc(step.meta)}</span>` : ""}</div>
<div class="fl-main">${step.head}${step.body}</div>
${step.bar ? `<div class="fl-bar" id="bar">${step.bar}</div>` : ""}</div>`;
}

/** What stands where the first video will be, until it is there. */
function videoNotice(order: Order, facts: Script | null): string {
  const v = order.video;
  if (v?.state === "facts" && facts) return factsHtml(order, facts);
  if (v?.state === "writing")
    return `<section class="notice" id="next"><h2>Your first video is being written</h2><p class="muted">${v.rounds ? "The script is being written again with your change." : "Your brand kit is approved and the script is being written."} This takes several minutes. Its facts appear here for you to check before anything is voiced or drawn.</p></section>`;
  if (v?.state === "painting") return `<section class="notice" id="next"><h2>The shots of your first video are being painted</h2><p class="muted">Its facts are approved. When the pictures are ready you check them before anything is voiced.</p></section>`;
  if (v?.state === "storyboard") return `<section class="notice" id="next"><h2>Check your storyboard</h2><p class="muted">Every shot of your first video is painted. Look at them, change what you want, then approve the storyboard to make the video.</p><a class="btn sm" href="/w/${esc(order.token)}?view=new">Open the storyboard</a></section>`;
  if (v?.state === "making") return `<section class="notice" id="next"><h2>Your first video is being made</h2><p class="muted">It is being voiced, drawn and checked. This takes several minutes, and the video appears here by itself.</p></section>`;
  if (v?.state === "failed")
    return `<section class="notice" id="next" role="alert"><h2>Your first video did not finish</h2>${failureHtml(order)}</section>`;
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
${kitSection(order, "name", `<p class="display" style="font-size:clamp(30px,5vw,46px)">${esc(kit.name)}</p><p class="lede">${esc(kit.promise)}</p>${pointHtml(kit)}${identityFacts(kit)}`)}
${kitSection(order, "host", `<p class="lede"><b style="color:var(--ink)">${esc(kit.host.name)}.</b> ${esc(kit.host.concept)}</p>${hostFacts(kit)}`)}
${kitSection(order, "colours", `${swatches(kit)}<p class="muted">Lettering: ${esc(kit.font)}</p>`)}
${kitSection(order, "look", `<p>${esc(kit.series.visual_style)}</p>${frames}`)}
${kitSection(order, "format", `<p class="lede">${esc(kit.series.format)}</p>${beats(kit)}`)}
${kitSection(order, "tone", `<div class="kv"><div><p class="label">Feels</p>${items(kit.tone, "chips")}</div><div><p class="label">Always</p>${items(kit.styleNotes, "list")}</div><div><p class="label">Never</p>${items(kit.never, "list no")}</div></div>`)}
${finishBar(order, canRevise)}
</div></div>`;
}

/** What needs the person on top of the channel's home: a video waiting for them, one under way, one that stopped, a pause. */
function needsHtml(order: Order, dash: Dashboard, facts: Script | null, at: (v: ConsoleView) => string, boards: boolean): string {
  const v = order.video;
  const steps = boards ? 4 : 3;
  const card = (kind: "warn" | "busy" | "bad", what: string, title: string, text: string, action = "") =>
    `<div class="need ${kind}${kind === "busy" ? " wait" : ""}"><div><span class="what-k">${what}</span>${title ? `<b>${esc(title)}</b>` : ""}${text}</div>${action}</div>`;
  const working = (what: string, step: number, text: string) => card("busy", `${what} · step ${step} of ${steps}`, "", `<div class="bar"><i></i></div><p>${text}</p>`);
  let cards = "";
  let yours = false;
  if (v?.state === "facts") {
    yours = true;
    cards = card("warn", "Check the facts", facts?.title ?? "", `<p>Nothing is voiced or drawn until you say the facts are right.</p>`, `<a class="act dark sm" href="${at("new")}">Check the facts</a>`);
  } else if (v?.state === "storyboard") {
    yours = true;
    cards = card("warn", "Check the pictures", "", `<p>Every shot is painted. Change what you want, then make the video.</p>`, `<a class="act dark sm" href="${at("new")}">Check the pictures</a>`);
  } else if (v?.state === "writing") cards = working("Writing the script", 2, `${v.rounds ? "It is being written again with your change." : "This takes several minutes."} You check its facts next.`);
  else if (v?.state === "painting") cards = working("Painting the pictures", 3, "This takes a minute or two. You check them next.");
  else if (v?.state === "making") cards = working("Making the video", steps, "Voicing, animating and checking it. It appears in Videos by itself.");
  else if (v?.state === "failed") {
    yours = true;
    cards = card("bad", "The last video did not finish", "", failureHtml(order));
  }
  if (dash.paused) {
    yours = true;
    cards += card("warn", "The channel is paused", "", `<p>No new videos are made while it is paused. Nothing is lost.</p>`, `<form method="post" action="/w/${esc(order.token)}/channel"><input type="hidden" name="status" value="active"><button type="submit" class="act dark sm">Resume the channel</button></form>`);
  }
  return cards ? `<section class="sec" aria-labelledby="needs"><h2 id="needs" class="kicker">${yours ? "Needs you" : "Under way"}</h2><div class="needs">${cards}</div></section>` : "";
}

export type ConsoleView = "overview" | "new" | "videos" | "video" | "ideas" | "settings";
export const CONSOLE_VIEWS: readonly ConsoleView[] = ["overview", "new", "videos", "video", "ideas", "settings"];

const icon = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PLUS = icon(`<path d="M12 5v14M5 12h14"/>`);
const TAB_ICONS = {
  videos: `<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m10 9 5 3-5 3z"/>`,
  ideas: `<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>`,
  look: `<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3-4 3h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22z"/>`,
  channels: `<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>`,
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The channel's main button colour: its primary colour when white lettering reads on it (4.5:1), otherwise ink. */
function actColour(kit: BrandKit): string {
  const hex = kit.colours.find((c) => c.name === "Primary")?.hex ?? "";
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#15141a";
  return 1.05 / (luminance(hex) + 0.05) >= 4.5 ? hex : "#15141a";
}

/** A finished video's picture for its tile: a frame from the middle, or the video itself when no frames were kept. */
function thumb(base: string, e: BrandKit["episodes"][number]): string {
  return e.frames.length
    ? `<img src="${base}/frame/${esc(e.id)}/${esc(e.frames[Math.min(1, e.frames.length - 1)])}" alt="" loading="lazy">`
    : `<video muted playsinline preload="metadata" src="${base}/video/${esc(e.id)}#t=1"></video>`;
}

/** 0:36 */
function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Nov 21 */
function day(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A link to where an idea's fact can be checked; the address as plain text when it is not an https web address. */
function factSource(source: string): string {
  if (!/^https:\/\/\S+$/.test(source) || !URL.canParse(source)) return `<span class="src">Source: ${esc(source)}</span>`;
  return `<a class="src" href="${esc(source)}" target="_blank" rel="noopener noreferrer nofollow">Check it at ${esc(new URL(source).hostname.replace(/^www\./, ""))}</a>`;
}

/** An idea's title, angle, its point and the fact it turns on, with where to check that fact. */
function ideaBody(i: Idea): string {
  const fact = i.fields.fact;
  const source = i.fields.fact_source;
  const yours = i.fields.by === "customer" ? `<small>Your own topic</small>` : "";
  return `<div><b>${esc(i.title)}</b>${i.angle ? `<small>${esc(i.angle)}</small>` : yours}${i.fields.point ? `<p class="fact"><span>The point</span>${esc(i.fields.point)}</p>` : ""}${fact ? `<p class="fact"><span>Key fact</span>${esc(fact)}${source ? ` ${factSource(source)}` : ""}</p>` : ""}</div>`;
}

/**
 * An approved channel's own studio: its videos first, what needs the person on top, one main action.
 * A bar with the channel and its three areas (Videos, Ideas, Look & voice); on a phone they move to a tab bar at the bottom.
 * `episode`: the finished video the "video" view shows (the server checks it exists).
 */
function consolePage(product: string, order: Order, kit: BrandKit, dash: Dashboard, facts: Script | null, view: ConsoleView, pick: boolean, episode: string | null, caps: CaptionsView | null): string {
  const base = `/w/${esc(order.token)}`;
  const at = (v: ConsoleView) => (v === "overview" ? base : `${base}?view=${v}`);
  const watch = (id: string) => `${base}?view=video&amp;e=${esc(id)}`;
  const busy = videoUnderWay(order);
  const made = kit.episodes.length;
  // Why a video can't be started now, if it can't.
  const blocked = busy ? "A video is under way" : dash.paused ? "The channel is paused" : dash.videosLeftToday === 0 ? "No more videos today" : "";
  const blockedWhy = busy ? "Start the next video when this one is finished." : dash.paused ? "Resume the channel under Look & voice to make videos." : "You can start more tomorrow.";
  const disabled = blocked ? ` disabled title="${esc(blocked)}"` : "";
  const suggesting = order.suggest?.state === "running";
  const boards = dash.hostOnScreen !== null;
  const makeBtn = (i: Idea) => `<form method="post" action="${base}/make"><input type="hidden" name="idea" value="${esc(i.id)}"><button type="submit" class="act dark sm"${disabled}>Make it</button></form>`;
  const skipBtn = (i: Idea) => `<form method="post" action="${base}/idea"><input type="hidden" name="idea" value="${esc(i.id)}"><button type="submit" class="quiet">Skip</button></form>`;
  const ideaCard = (i: Idea) => `<li class="icard">${ideaBody(i)}<div class="do">${makeBtn(i)}${skipBtn(i)}</div></li>`;
  const decide = (draft: string, ideaId: string, d: "keep" | "skip" | "keep-all", label: string, cls: string) =>
    `<form method="post" action="${base}/proposal"><input type="hidden" name="draft" value="${esc(draft)}">${ideaId ? `<input type="hidden" name="idea" value="${esc(ideaId)}">` : ""}<input type="hidden" name="decision" value="${d}"><button type="submit" class="${cls}">${label}</button></form>`;
  const proposal = (p: Dashboard["proposals"][number]) => `<li class="icard">${ideaBody(p.idea)}<div class="do">${decide(p.draft, p.idea.id, "keep", "Keep", "act dark sm")}${decide(p.draft, p.idea.id, "skip", "Skip", "quiet")}</div></li>`;
  const askIdeas = (label: string) =>
    suggesting
      ? `<p role="status">New ideas${order.suggest?.direction ? ` about “${esc(order.suggest.direction)}”` : ""} are being written for your channel. This takes a minute or two, and they appear here by themselves.</p>`
      : dash.suggestsLeftToday
        ? `<form class="own" method="post" action="${base}/suggest"><label class="f" for="direction">${label} <small>Optional: a theme, or leave it empty for ideas across the whole channel.</small><input type="text" id="direction" name="direction" maxlength="${TOPIC_MAX}" placeholder="The deep sea"></label><button type="submit" class="act sm">Suggest ideas</button></form>`
        : `<p>No more suggestions today. Ask again tomorrow.</p>`;
  const tile = (e: BrandKit["episodes"][number]) =>
    `<a class="vt" href="${watch(e.id)}"><span class="pic">${thumb(base, e)}<span class="tag ok">Ready</span>${e.seconds === null ? "" : `<span class="len">${clock(e.seconds)}</span>`}</span><b>${esc(e.title)}</b><small>${esc(day(e.date))}</small></a>`;
  const newest = [...kit.episodes].reverse();
  const blockedNote = blocked && dash.ideas.length ? `<p class="muted" style="font-size:14.5px">${esc(blocked)}: ${esc(blockedWhy.charAt(0).toLowerCase() + blockedWhy.slice(1))}</p>` : "";

  let main: string;
  let title: string;
  // What slides over the page (the flow's sheets), after everything else.
  let sheets = "";
  if (view === "new") {
    title = "New video";
    const v = order.video;
    // Looks with a painted world stop at their pictures between the script and the video.
    const names = boards ? ["Topic", "Script", "Pictures", "Video"] : ["Topic", "Script", "Video"];
    const flow = (i: number, step: FlowStep): [number, FlowStep] => [i, step];
    const [now, step] = ((): [number, FlowStep] => {
    if (v?.state === "facts" && facts) return flow(1, scriptStep(order, facts, boards));
    if (v?.state === "writing" || v?.state === "facts")
      return flow(1, waitStep("The script is being written", `${v.rounds ? "It is being written again with your change." : "This takes several minutes."} You can leave this page: it keeps going, and this page updates by itself.`, ["Writing the lines and finding a source for every fact", "You read the script here and check its facts", boards ? "Then the pictures, then the video" : "Then the video"]));
    if (v?.state === "storyboard" && dash.storyboard) return flow(2, picturesStep(order, dash.storyboard, accentOf(kit)));
    if (v?.state === "painting" || v?.state === "storyboard")
      return flow(2, waitStep("The pictures are being painted", "This takes a minute or two. This page updates by itself.", ["Painting every shot", "You check the pictures and the speed here", "Then the video is made"]));
    if (v?.state === "making")
      return flow(names.length - 1, waitStep("Your video is being made", "It takes several minutes. Nothing more is needed from you: it appears in Videos by itself.", ["Voicing it, putting the pictures in motion and adding the captions", "Checking it", "It appears here and in Videos, ready to download"]));
    const last = v?.state === "done" && v.idea && v.episode ? kit.episodes.find((e) => e.id === v.episode) : undefined;
    if (last && !pick) return flow(names.length - 1, readyStep(base, last, dash.ideas[0], `${at("new")}&amp;pick`, busy));
    const failed = v?.state === "failed" ? `<div class="card" role="alert"><h2>The last video did not finish</h2>${failureHtml(order)}</div>` : "";
    const stop = blocked ? `<div class="card" role="status"><h2>${esc(blocked)}</h2><p class="sub">${esc(blockedWhy)}</p>${dash.paused ? `<a class="line-btn" href="${at("settings")}">Go to Look &amp; voice</a>` : ""}</div>` : "";
    const picks = dash.ideas.length
      ? `<div class="or">or start from one of your ideas</div><div class="picks" role="radiogroup" aria-label="Your ideas">${dash.ideas.map((i) => `<label class="idea-pick"><input type="radio" name="idea" value="${esc(i.id)}" form="make"${blocked ? " disabled" : ""}>${ideaBody(i)}</label>`).join("")}</div><a class="more-ideas" href="${at("ideas")}">Get more ideas</a>`
      : `<p class="sub">No ideas are waiting. <a href="${at("ideas")}">Get ideas for ${esc(kit.name)}</a></p>`;
    return flow(0, {
      meta: "",
      head: `<div class="head"><h1>What’s this one about?</h1><p class="sub">A myth, a habit, a wild true story: one line is enough. You check the facts it finds before anything is voiced or drawn.</p></div>`,
      body: `${failed}${stop}<form id="make" method="post" action="${base}/make"><label class="own-topic" for="topic">Your own topic<input type="text" id="topic" name="topic" minlength="4" maxlength="${TOPIC_MAX}" placeholder="Why the sea is salty"${blocked ? " disabled" : ""}></label></form>${picks}`,
      bar: `<button type="submit" form="make" class="go"${disabled}>Write the script</button><small>${blocked ? esc(blocked) : `${dash.videosLeftToday} video${dash.videosLeftToday === 1 ? "" : "s"} left today`}</small>`,
      sheets: "",
    });
    })();
    main = flowHtml(names, now, step);
    sheets = step.sheets;
  } else if (view === "video") {
    const e = kit.episodes.find((x) => x.id === episode);
    if (!e) throw new Error(`consolePage: no finished video "${episode}" in ${kit.slug}`);
    title = e.title;
    const tip = (svg: string, text: string) => `<li class="tip">${svg}<span>${esc(text)}</span></li>`;
    const note = (n: string) => tip(icon(`<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>`), n);
    const shown = e.review.slice(0, 2);
    const rest = e.review.slice(2);
    const copy = e.caption ? [e.caption.text, e.caption.hashtags.join(" ")].filter(Boolean).join("\n\n") : "";
    const versions = e.versions.length ? `<p class="muted" style="font-size:14.5px">Earlier versions: ${e.versions.map((n) => `<a href="${base}/video/${esc(e.id)}/v/${n}">v${n}</a>`).join(", ")}</p>` : "";
    main = `<a class="back" href="${at("videos")}">${icon(`<path d="m15 18-6-6 6-6"/>`)}All videos</a>
<div class="vpage"><div class="player">${
      caps
        ? `<div class="live"><video id="cap-video" controls playsinline preload="metadata" src="${base}/video/${esc(e.id)}/clean?r=${e.versions.length}"${e.frames.length ? ` poster="${base}/frame/${esc(e.id)}/${esc(e.frames[0])}"` : ""}></video><div id="cap-layer" aria-hidden="true"></div></div>`
        : `<video controls playsinline preload="metadata" src="${base}/video/${esc(e.id)}?r=${e.versions.length}"${e.frames.length ? ` poster="${base}/frame/${esc(e.id)}/${esc(e.frames[0])}"` : ""}></video>`
    }<small>${e.seconds === null ? "" : `${clock(e.seconds)} · `}vertical 1080 × 1920</small></div>
<div class="side2">
<div class="sec" style="gap:10px"><span class="tag ok">Ready to post</span><h1>${esc(e.title)}</h1><p class="muted">Made ${esc(day(e.date))}</p></div>
<div class="row2"><a class="act" href="${base}/video/${esc(e.id)}?download=1">${icon(`<path d="M12 4v12M6 10l6 6 6-6M5 20h14"/>`)}Download video</a>${copy ? `<button type="button" class="act line" data-copy="${esc(copy)}">Copy caption &amp; hashtags</button>` : ""}</div>
${caps ? captionsStep(base, e.id, caps, kit) : ""}
${e.captions_file ? `<div class="sec" style="gap:8px"><a class="act line" href="${base}/captions/${esc(e.id)}">Download captions (.srt)</a><p class="muted" style="font-size:14px">The spoken words with their timings, to lay over the video in CapCut, Premiere or YouTube Studio and style them as you like.</p></div>` : ""}
${e.caption ? `<div class="panel cap"><span class="kicker">Caption</span><p>${esc(e.caption.text)}</p>${e.caption.hashtags.length ? `<p class="hash">${esc(e.caption.hashtags.join(" "))}</p>` : ""}</div>` : ""}
<div class="sec" style="gap:12px"><h2 class="h3">Before you post</h2><ul class="tips2">${tip(icon(`<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>`), "Turn on the platform’s AI label when you post: YouTube, TikTok and Instagram ask for it on AI-made videos.")}${shown.map(note).join("")}</ul>${rest.length ? `<details class="more2"><summary>Show ${rest.length} more note${rest.length === 1 ? "" : "s"}</summary><ul class="tips2">${rest.map(note).join("")}</ul></details>` : ""}${e.review.length ? `<p class="muted" style="font-size:14px">Notes from our automatic review. The video is finished: they are tips for the next one.</p>` : ""}</div>
<div class="sec change" style="gap:12px"><h2 class="h3">Change something</h2>${e.revisable ? `<p class="muted">Opens this video’s storyboard: change a picture or the speed. This version stays until the new one is ready.</p><form method="post" action="${base}/revise-video"><input type="hidden" name="episode" value="${esc(e.id)}"><button type="submit" class="act line"${busy ? ' disabled title="A video is under way"' : ""}>Change something</button></form>` : `<p class="muted">This video was made before storyboards were kept, so it can't be changed. New videos can.</p>`}${versions}</div>
</div></div>`;
  } else if (view === "ideas") {
    title = "Ideas";
    const failed = order.suggest?.state === "failed" ? `<p class="error" role="alert">The last request for ideas did not finish. Nothing is lost: ask again.</p>` : "";
    const batches = [...new Set(dash.proposals.map((p) => p.draft))].map((draft) => dash.proposals.filter((p) => p.draft === draft));
    const batch = (ps: Dashboard["proposals"]) =>
      `<section class="sec"><div class="hd"><h2>Suggested for you</h2><span class="grow"></span>${ps.length > 1 ? decide(ps[0].draft, "", "keep-all", `Keep all ${ps.length}`, "act line sm") : ""}</div><p class="muted">Check each key fact at its source. Kept ideas join your ideas, ready to make. Skipped ones are never made.</p><ul class="icards">${ps.map(proposal).join("")}</ul></section>`;
    main = `<h1>Ideas</h1>
<div class="panel"><div class="hd2"><h2>Get new ideas</h2><span class="grow"></span><small class="muted">${dash.suggestsLeftToday} of ${SUGGESTS_PER_DAY} left today</small></div>${failed}${askIdeas("About what?")}</div>
${batches.map(batch).join("")}
<section class="sec"><div class="hd"><h2>Waiting to be made</h2><small>${dash.ideas.length}</small><span class="grow"></span><a href="${at("new")}">Your own topic</a></div>${dash.ideas.length ? `<ul class="icards">${dash.ideas.map(ideaCard).join("")}</ul>${blockedNote}` : `<p class="muted">No ideas are waiting. Ask for new ones above.</p>`}</section>`;
  } else if (view === "settings") {
    title = "Look & voice";
    const latest = kit.episodes.at(-1);
    const off = busy ? ` disabled title="A video is under way"` : "";
    const host =
      dash.hostOnScreen === null
        ? ""
        : `<p class="muted">${dash.hostOnScreen ? "The host appears in the shots that call for it." : "The host is off screen: the voice narrates every video."}</p><form method="post" action="${base}/host"><input type="hidden" name="on" value="${dash.hostOnScreen ? "0" : "1"}"><button type="submit" class="act line sm"${off}>${dash.hostOnScreen ? "Take the host off screen" : "Put the host on screen"}</button></form>${
            dash.hostOnScreen
              ? `<p class="muted">${dash.hostLead ? "The host is the main character: every part of a new video shows it in at least one shot." : "Optional: make the host the main character, so every part of a new video shows it in at least one shot."} Videos already made stay as they are.</p><form method="post" action="${base}/host"><input type="hidden" name="lead" value="${dash.hostLead ? "0" : "1"}"><button type="submit" class="act line sm"${off}>${dash.hostLead ? "Show the host only where a shot calls for it" : "Make the host the main character"}</button></form>`
              : ""
          }`;
    main = `<h1>Look &amp; voice</h1>
<div class="look">${latest ? `<div class="prev">${thumb(base, latest)}</div>` : ""}<div class="cols">
<div class="panel"><h2>Name, promise and point</h2><b class="big-name">${esc(kit.name)}</b><p class="muted">${esc(kit.promise)}</p>${pointHtml(kit)}</div>
<div class="panel"><h2>${order.design?.theme ? esc(lookName(order.design.theme)) : "Look"}</h2><div class="sws">${kit.colours.map((c) => `<div><i style="background:${esc(c.hex)}"></i>${esc(c.name)}</div>`).join("")}</div></div>
<div class="panel"><h2>Captions</h2><p class="muted">How captions look in every new video. You can still change them on each finished video, and see them live.</p>${captionsForm(`${base}/captions`, dash.captions, accentOf(kit), kit.font, null, "Save caption settings")}</div>
<div class="panel"><h2>Host</h2><p><b>${esc(kit.host.name)}.</b> ${esc(kit.host.concept)}</p>${host}</div>
<div class="panel"><h2>Format</h2><p class="muted">${esc(kit.series.format)}</p></div>
<div class="panel"><h2>${dash.paused ? "Paused" : "Making videos"}</h2><p class="muted">${dash.paused ? "No new videos are made while the channel is paused. Nothing is lost." : "Pausing stops new videos. Nothing is lost, and you can resume at any time."}</p><form method="post" action="${base}/channel"><input type="hidden" name="status" value="${dash.paused ? "active" : "paused"}"><button type="submit" class="act ${dash.paused ? "dark" : "line"} sm">${dash.paused ? "Resume the channel" : "Pause the channel"}</button></form></div>
</div></div>`;
  } else {
    title = "Videos";
    const latest = newest[0];
    const state = dash.paused ? `<span class="tag"><i></i>Paused</span>` : busy ? `<span class="tag busy"><i></i>Making a video</span>` : `<span class="tag ok"><i></i>Active</span>`;
    const add = blocked ? "" : `<a class="vt add" href="${at("new")}"><span class="pic">${PLUS}New video</span></a>`;
    main = `<div class="chead">${latest?.frames.length ? `<img class="cover" src="${base}/frame/${esc(latest.id)}/${esc(latest.frames[0])}" alt="">` : ""}<div><h1>${esc(kit.name)}</h1><p>${esc(kit.promise)}</p></div><div class="tags">${state}<span class="tag">${dash.videosLeftToday} left today</span></div></div>
${needsHtml(order, dash, facts, at, boards)}
<section class="sec" aria-labelledby="vh"><div class="hd"><h2 id="vh">Videos</h2><small>${made ? `${made} made` : ""}</small></div>${made ? `<div class="vgrid">${newest.map(tile).join("")}${add}</div>` : `<div class="panel"><p class="muted">Your finished videos appear here, ready to download and post.</p>${blocked ? "" : `<a class="act sm" href="${at("new")}">Make your first video</a>`}</div>`}</section>
<section class="sec" aria-labelledby="ih"><div class="hd"><h2 id="ih">Up next</h2><small>${dash.ideas.length} idea${dash.ideas.length === 1 ? "" : "s"} waiting</small><span class="grow"></span><a href="${at("ideas")}">All ideas</a></div><ul class="icards">${dash.ideas.slice(0, 2).map(ideaCard).join("")}<li class="icard ask">${askIdeas("Want ideas about something?")}</li></ul>${blockedNote}</section>`;
  }
  const on = (tab: "videos" | "ideas" | "look") =>
    (tab === "videos" ? view === "overview" || view === "videos" || view === "video" : tab === "ideas" ? view === "ideas" : view === "settings") ? ' aria-current="page"' : "";
  const tabIcon = (k: keyof typeof TAB_ICONS) => icon(TAB_ICONS[k]);
  const top = `<header class="sbar"><div class="in"><a class="brand" href="/"><i></i><span>${esc(product)}</span></a><span class="sep" aria-hidden="true">/</span>${order.user ? `<a class="switch" href="/account" title="Your channels"><span>${esc(kit.name)}</span>${icon(`<path d="m6 9 6 6 6-6"/>`)}</a>` : `<span class="switch"><span>${esc(kit.name)}</span></span>`}<nav class="stab" aria-label="${esc(kit.name)}"><a href="${base}"${on("videos")}>Videos</a><a href="${at("ideas")}"${on("ideas")}>Ideas</a><a href="${at("settings")}"${on("look")}>Look &amp; voice</a></nav><span class="grow"></span>${view === "new" ? `<a class="act line sm" href="${base}">Close</a>` : `<a class="act new" href="${at("new")}">${PLUS}New video</a>`}</div></header>`;
  const tabs = view === "new" ? "" : `<nav class="mtabs" aria-label="${esc(kit.name)}"><a href="${base}"${on("videos")}>${tabIcon("videos")}Videos</a><a href="${at("ideas")}"${on("ideas")}>${tabIcon("ideas")}Ideas</a><a class="plus" href="${at("new")}" aria-label="New video">${PLUS}</a><a href="${at("settings")}"${on("look")}>${tabIcon("look")}Look</a>${order.user ? `<a href="/account">${tabIcon("channels")}Channels</a>` : ""}</nav>`;
  const waiting = isMakingVideo(order) || suggesting;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ${esc(kit.name)}</title>${waiting ? `<meta http-equiv="refresh" content="20">` : ""}<style>${CSS}</style>${tag("console")}</head><body class="studio" style="--act:${actColour(kit)}">
${top}<main class="spage${tabs ? " tabbed" : ""}">${main}</main>${tabs}
${sheets}</body></html>`;
}

/** `canRevise`: change requests are made automatically (automatic builds are on). `facts`: the script whose facts the customer is checking, if any. `dash`: the channel's dashboard, once it has one. */
/** `caps`: the open video's captions step, when it has one (videos rendered before clean renders were kept don't). */
export function workspacePage(product: string, order: Order, kit: BrandKit | null, paymentUrl: string | null, canRevise: boolean, facts: Script | null = null, dash: Dashboard | null = null, view: ConsoleView = "overview", pick = false, episode: string | null = null, caps: CaptionsView | null = null): string {
  // An approved channel built here is its own app from now on.
  if (kit && dash) return consolePage(product, order, kit, dash, facts, view, pick, episode, caps);
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

/** A look as the customer says it: "Your own look" for one they designed, else "Bistro chalkboard look". */
function lookName(theme: Theme): string {
  return theme.name === OWN_DESIGN ? "Your own look" : `${theme.name} look`;
}

/** Where a channel stands, as one short tag on its card. */
function channelTag(o: Order, kit: BrandKit | undefined): string {
  const v = o.video?.state;
  if (v === "facts" || v === "storyboard") return `<span class="tag warn">Needs you</span>`;
  if (v === "writing" || v === "painting" || v === "making") return `<span class="tag busy">Making a video</span>`;
  if (v === "failed") return `<span class="tag bad">Video failed</span>`;
  if (o.status === "awaiting-payment") return `<span class="tag warn">Payment due</span>`;
  if (isBuilding(o)) return `<span class="tag busy">Being built</span>`;
  if (kit && !o.kit_approved) return `<span class="tag warn">Needs you</span>`;
  if (kit?.episodes.length) return `<span class="tag ok">${kit.episodes.length} ready</span>`;
  return `<span class="tag">${esc(STATUS_TEXT[o.status])}</span>`;
}

/** Everything one account has: the design saved for later, and each channel as a card. `kits`: each order's channel, once it is built. */
export function accountPage(product: string, user: User, orders: Order[], kits: ReadonlyMap<string, BrandKit>, draft: Draft | undefined): string {
  const saved = draft
    ? `<div class="panel"><h2>Your saved design</h2><p class="muted">${draft.form.idea ? esc(draft.form.idea) : "Not described yet."} Saved ${esc(draft.saved.slice(0, 10))}.</p><a class="act sm" href="/create">Continue designing</a></div>`
    : "";
  const card = (o: Order) => {
    const kit = kits.get(o.id);
    const base = `/w/${esc(o.token)}`;
    const shown = kit ? [...kit.episodes].reverse().filter((e) => e.frames.length).slice(0, 3) : [];
    const cover = shown.length
      ? `<span class="strip3">${shown.map((e) => `<img src="${base}/frame/${esc(e.id)}/${esc(e.frames[Math.min(1, e.frames.length - 1)])}" alt="" loading="lazy">`).join("")}${"<span></span>".repeat(3 - shown.length)}</span>`
      : `<span class="empty">No video yet</span>`;
    // Until the kit is built the channel has no name, so the first words of its brief stand in.
    const name = kit?.name ?? o.intake.idea.split(/[.:!?\n]/)[0].slice(0, 60);
    const n = kit?.episodes.length ?? 0;
    const theme = o.design?.theme;
    const sub = [theme ? lookName(theme) : "", kit ? `${n} video${n === 1 ? "" : "s"}` : `Sent ${day(o.created.slice(0, 10))}`].filter(Boolean).join(" · ");
    // The look's own colours, so channels with the same name and an own-designed look still look different here.
    const dots = theme ? `<span class="dots" aria-hidden="true">${[theme.paper, theme.accent, ...theme.colors].map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span>` : "";
    return `<a class="ch" href="${base}">${cover}<span class="info"><span class="t"><b>${esc(name)}</b>${channelTag(o, kit)}</span><small>${dots}${esc(sub)}</small></span></a>`;
  };
  const cards = orders.slice().reverse().map(card).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My channels — ${esc(product)}</title><style>${CSS}</style></head><body class="studio">
<header class="sbar"><div class="in"><a class="brand" href="/"><i></i><span>${esc(product)}</span></a><span class="grow"></span><span class="who">${esc(user.email)}</span><form method="post" action="/signout"><button type="submit" class="act line sm">Sign out</button></form></div></header>
<main class="spage"><div class="hd2"><h1>Your channels</h1><span class="grow"></span><a class="act dark" href="/create?new">${PLUS}Design a channel</a></div>
${saved}${cards ? `<div class="chgrid">${cards}</div>` : draft ? "" : `<p class="muted">Nothing here yet. Design your first channel and it shows up on this page.</p>`}</main></body></html>`;
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
