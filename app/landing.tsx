import Image from "next/image";
import { useEffect, useRef } from "react";
import { animate, inView, scroll, stagger } from "motion";
import { useAnimate } from "motion/react";
import { platforms } from "@/lib/model";
import { Brand, Icon, PlatformMark, SiteFooter } from "./ui";
import "./landing.css";

const chapters = [
  {
    id: "workflows", title: "Workflows", icon: "compose",
    statement: "Take one brief from a first idea to", emphasis: "three channel-ready posts.",
    details: [
      ["Start with a brief", "Describe the post once. Keep its brief, captions, and media together while you work."],
      ["Write for each channel", "Draft a separate caption for every destination. Generate it from the brand voice or write it yourself."],
      ["Review before scheduling", "Check the media order, read each caption, and confirm the scheduled time."],
    ],
  },
  {
    id: "brand-voice", title: "Brand voice", icon: "voice",
    statement: "Switch between projects and give each brand", emphasis: "a voice of its own.",
    details: [
      ["Define the audience", "Describe what the brand makes and who it speaks to."],
      ["Set the tone", "Save the tone, example copy, and words to avoid alongside the project."],
      ["Keep the voice close", "Edit the saved brand voice as it evolves. New caption drafts use the updated guidance."],
    ],
  },
  {
    id: "schedule", title: "Schedule", icon: "calendar",
    statement: "See what’s going out, when it’s due, and where it’s headed.", emphasis: "All in one place.",
    details: [
      ["See what’s next", "Find upcoming posts across projects in the workspace overview."],
      ["Adjust the timing", "Open a scheduled post to change its time or cancel it across the selected channels."],
      ["Check each destination", "Expand a post to see the caption and schedule status for each selected channel."],
    ],
  },
] as const;

type Chapter = (typeof chapters)[number]["id"];

const toolsIndex = [
  ["Projects", "folder"], ["Brand voice", "voice"], ["Post briefs", "compose"],
  ["Captions", "spark"], ["Media", "upload"],
] as const;

const sectionLinks = [
  ["#index", "Publishing index"],
  ["#features", "Workflows"],
  ["#faq", "FAQ"],
] as const;

const questions = [
  ["What do I need to get started?", "Create an account with your email and a password, or sign in. Create a brand project, then connect the channels you want to plan for."],
  ["How do I publish a scheduled post?", "Connect a Facebook Page, and its linked Instagram account, under Channels. Hub Connect then publishes to them at the scheduled time. TikTok posts stay in your schedule for you to share yourself."],
  ["Can I write my own captions?", "Yes. Write or edit any caption in the composer. If Claude is configured, you can also generate a draft using the project’s saved brand voice."],
  ["Which time zone does the schedule use?", "Hub Connect shows dates and times in your browser’s local time zone."],
];

function SchedulePreview() {
  return (
    <div className="sample-sheet">
      <div className="sample-meta"><span>Form Studio</span><Icon name="calendar" /></div>
      <strong>Publishing schedule</strong>
      {platforms.map((platform) => (
        <div className="sample-row" key={platform}>
          <PlatformMark platform={platform} />
          <span>{platform}</span><span className="sample-time">Fri · 10:00</span>
        </div>
      ))}
    </div>
  );
}

function ProductScene({ chapter }: { chapter: Chapter }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stage.current) {
      return inView(stage.current, (element) => {
        element.classList.add("scene-visible");
      });
    }
  }, []);
  return (
    <div ref={stage} className="product-stage" aria-hidden="true">
      {chapter === "schedule" ? (
        <><SchedulePreview /><div className="scene-note"><Icon name="clock" /><span>Next post<strong>Friday at 10:00</strong></span></div></>
      ) : chapter === "workflows" ? (
        <>
          <div className="sample-post">
            <div className="sample-meta"><span>Form Studio</span><PlatformMark platform="Instagram" /></div>
            <Image src="/routing-study.webp" width={460} height={345} sizes="(max-width: 700px) 45vw, 310px" alt="" />
            <div className="post-copy"><strong>Routes in color.</strong><p>Three paths, one starting point. A new study in shape and color.</p></div>
          </div>
          <div className="sample-flow">
            <span><Icon name="voice" />Post brief</span>
            <span><Icon name="compose" />Edit captions</span>
            <span><Icon name="calendar" />Schedule post</span>
          </div>
        </>
      ) : (
        <>
          <div className="sample-voice">
            <Icon name="voice" /><strong>Voice settings</strong>
            <span>Audience</span><p>Designers and collectors</p>
            <span>Tone</span><p>Curious, warm, direct</p>
          </div>
          <div className="voice-page">
            <div className="sample-meta">Form Studio<Icon name="compose" /></div>
            <div className="voice-excerpt">
              <strong>Our voice.</strong>
              <p>Look closely. Find the detail that makes a familiar object feel new.</p>
              <span>Words we use</span>
              <div>Form · Texture · Color</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const blobVertex = "attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}";
// Fake-3D sphere whose rim wobbles over time; the surface normal is also warped so the brand colors flow across it.
const blobFragment = `precision mediump float;
varying vec2 v;uniform float t;uniform vec3 m;
vec3 pal(float h){
  h=fract(h)*4.;
  vec3 y=vec3(.98,.8,.06),p=vec3(.94,.42,.66),b=vec3(.47,.73,.9),w=vec3(1.,.97,.93);
  return h<1.?mix(y,p,smoothstep(0.,1.,h)):h<2.?mix(p,b,smoothstep(1.,2.,h)):h<3.?mix(b,w,smoothstep(2.,3.,h)):mix(w,y,smoothstep(3.,4.,h));
}
void main(){
  vec2 q=v*1.3;
  float a=atan(q.y,q.x);
  float r=.96+.045*sin(3.*a+t*.9)+.03*sin(5.*a-t*1.3+1.)+.018*sin(8.*a+t*1.9+2.);
  vec2 s=q/r;
  float d=length(s);
  float alpha=smoothstep(1.,.985,d);
  float z=sqrt(max(0.,1.-d*d));
  vec3 n=normalize(vec3(s+.22*vec2(sin(s.y*2.7+t*.7),cos(s.x*2.3-t*.6)),z));
  vec3 col=pal(.12*n.x-.16*n.y+.14*sin(n.x*1.6+n.y*1.2+t*.3)+.03*t);
  col=mix(col,vec3(1.,.98,.96),.25+pow(1.-z,2.)*.5);
  col*=1.-.2*smoothstep(.1,.9,-n.y)*z;
  vec3 l=normalize(vec3(m.x*2.,-m.y*2.,1.));
  col+=(.12+m.z*.3)*pow(max(dot(n,l),0.),24.);
  gl_FragColor=vec4(min(col,1.)*alpha,alpha);
}`;

function fluidBlob(canvas: HTMLCanvasElement, pointer: { x: number; y: number; on: number }) {
  const gl = canvas.getContext("webgl");
  if (!gl) return;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, blobVertex], [gl.FRAGMENT_SHADER, blobFragment]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "p");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const time = gl.getUniformLocation(program, "t");
  const light = gl.getUniformLocation(program, "m");
  const eased = { x: -.15, y: -.2, on: 0 };
  let frame = 0;
  const draw = (now: number) => {
    const size = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 1.5));
    if (size && canvas.width !== size) {
      canvas.width = canvas.height = size;
      gl.viewport(0, 0, size, size);
    }
    eased.x += ((pointer.on ? pointer.x : -.15) - eased.x) * .08;
    eased.y += ((pointer.on ? pointer.y : -.2) - eased.y) * .08;
    eased.on += (pointer.on - eased.on) * .08;
    gl.uniform1f(time, now / 1000);
    gl.uniform3f(light, eased.x, eased.y, eased.on);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

// Fixed behind the whole homepage; page scroll carries it through each section, like the reference site.
function HeroOrb() {
  const orbit = useRef<HTMLDivElement>(null);
  const blob = useRef<HTMLCanvasElement>(null);
  const sphere = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ring = orbit.current;
    const orb = sphere.current;
    const highlight = light.current;
    const canvas = blob.current;
    const hero = document.querySelector<HTMLElement>(".land-hero");
    if (!hero || !ring || !orb || !highlight || !canvas) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const pointer = { x: 0, y: 0, on: 0 };
    function start() {
      if (!motion.matches || !hero || !ring || !orb || !highlight || !canvas) return;
      // Without WebGL the CSS sphere stays visible as the fallback.
      const stopBlob = fluidBlob(canvas, pointer);
      if (stopBlob) ring.classList.add("fluid");
      // hero → swells off the right edge (intro, index) → small at bottom-left (workflows) → back right (FAQ)
      const travel = animate(ring, {
        transform: [
          "translate(0%, 0%) scale(1)",
          "translate(55%, 10%) scale(1.9)",
          "translate(-105%, 45%) scale(.6)",
          "translate(-20%, 10%) scale(.85)",
        ],
      }, { ease: "linear", times: [0, .2, .55, 1] });
      const stopScroll = scroll(travel);
      const follow = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const bounds = orb.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        const strength = Math.max(0, 1 - Math.max(0, Math.hypot(x, y) - .5) * 2);
        Object.assign(pointer, { x, y, on: strength });
        highlight.style.opacity = String(strength);
        highlight.style.transform = `translate(${x * 78}%, ${y * 78}%)`;
      };
      const clear = () => { highlight.style.opacity = "0"; pointer.on = 0; };
      hero.addEventListener("pointermove", follow);
      hero.addEventListener("pointerleave", clear);
      return () => {
        hero.removeEventListener("pointermove", follow);
        hero.removeEventListener("pointerleave", clear);
        stopScroll();
        travel.cancel();
        stopBlob?.();
        ring.classList.remove("fluid");
        clear();
      };
    }
    let stop = start();
    const sync = () => { stop?.(); stop = start(); };
    motion.addEventListener("change", sync);
    return () => { motion.removeEventListener("change", sync); stop?.(); };
  }, []);
  return (
    <div ref={orbit} className="sphere-orbit" aria-hidden="true">
      <div ref={sphere} className="sphere"><div ref={light} className="sphere-light" /></div>
      <canvas ref={blob} className="blob" />
    </div>
  );
}

export function Landing({ enter, busy, error }: { enter: (fields: Record<string, string>) => void; busy: boolean; error: string }) {
  const topEdge = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLAnchorElement>(null);
  const [indexGrid, animateIndex] = useAnimate<HTMLUListElement>();
  useEffect(() => {
    return inView(indexGrid.current, () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animateIndex("li", { opacity: [.55, 1], y: [6, 0] }, {
        duration: .22, ease: "easeOut", delay: stagger(.025),
      });
    }, { amount: .2 });
  }, [indexGrid, animateIndex]);
  useEffect(() => {
    const link = cue.current;
    if (topEdge.current && link) {
      return inView(topEdge.current, () => {
        link.hidden = false;
        return () => { link.hidden = true; };
      });
    }
  }, []);
  const signIn = (
    <form
      className="signin"
      onSubmit={(e) => {
        e.preventDefault();
        enter(Object.fromEntries(new FormData(e.currentTarget, e.nativeEvent.submitter)) as Record<string, string>);
      }}
    >
      <input id="email" name="email" type="email" autoComplete="email" required aria-label="Email" placeholder="Email" />
      <input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} aria-label="Password" placeholder="Password" />
      <button className="ghost" name="action" value="signin" disabled={busy}>
        {busy ? "Opening workspace…" : "Sign in"} <Icon name="arrow" size={17} />
      </button>
      <button className="ghost" name="action" value="signup" disabled={busy}>Create account</button>
    </form>
  );
  return (
    <div className="landing" id="top">
      <div className="top-edge" ref={topEdge} aria-hidden="true" />
      <header className="site-header">
        <div className="mast-inner wide">
          <a className="mast-brand" href="#top" aria-label="Hub Connect home"><Brand /></a>
          <nav aria-label="Homepage navigation">
            {sectionLinks.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
          </nav>
          <a className="mast-action" href="#email">Sign in <Icon name="arrow" size={16} /></a>
        </div>
      </header>
      <main>
        <HeroOrb />
        <section className="land-hero wide">
          <h1>Social<br />publishing<br />workspace.</h1>
          <div className="hero-foot">
            <p>One brief. Three channels.<br />Your brand’s own voice.</p>
            {signIn}
          </div>
          <a ref={cue} href="#about" className="scroll-cue" hidden>Scroll ↓</a>
        </section>
        <div className="wide">
          <section id="about" className="land-intro">
            <div>
              <h2 className="section-label">The workspace</h2>
              <a className="ghost" href="#features">Explore features <Icon name="arrow" size={17} /></a>
            </div>
            <p>Bring your brand voice, media, and publishing schedule into one place. Write a brief, tailor each caption, and review what goes to Facebook, Instagram, and TikTok.</p>
          </section>
          <section id="index" className="land-section">
            <h2 className="section-label">Publishing index</h2>
            <ul className="index-grid" ref={indexGrid}>
              {toolsIndex.map(([name, icon]) => <li key={name}><Icon name={icon} />{name}</li>)}
              {platforms.map(p => <li key={p}><PlatformMark platform={p} />{p}</li>)}
              <li><Icon name="check" />Review</li><li><Icon name="calendar" />Schedule</li>
            </ul>
          </section>
          <section id="features" className="land-section">
            <h2 className="section-label">Featured workflows</h2>
            <div className="work-grid">
              {chapters.map(chapter => (
                <article className="work-card" id={chapter.id} key={chapter.id}>
                  <h3>{chapter.title}</h3>
                  <ProductScene chapter={chapter.id} />
                  <p>{chapter.statement} {chapter.emphasis}</p>
                  {chapter.details.map(([title, copy]) => (
                    <details key={title} name={chapter.id}>
                      <summary>{title}<Icon name="plus" size={16} /></summary><p>{copy}</p>
                    </details>
                  ))}
                </article>
              ))}
            </div>
          </section>
          <section className="land-faq land-section" id="faq">
            <h2>Frequently asked<br />questions.</h2>
            <div>{questions.map(([question, answer]) => (
              <details key={question}><summary>{question}<Icon name="plus" size={16} /></summary><p>{answer}</p></details>
            ))}</div>
          </section>
        </div>
      </main>
      <SiteFooter>
        <a href="#about">The workspace</a>
        {sectionLinks.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        <a href="#email">Sign in <Icon name="arrow" size={15} /></a>
      </SiteFooter>
      {error && <p className="land-error error" role="alert">{error}</p>}
    </div>
  );
}

