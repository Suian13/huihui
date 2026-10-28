import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../../script.js", import.meta.url), "utf8");

function harness({ reduced = false, fine = true } = {}) {
  const make = () => {
    const events = new Map(), props = new Map(), classes = new Set();
    return {
      events, props, classes,
      hidden: true, setAttribute: (k,v) => props.set(k,v),
      style: { setProperty: (k,v) => props.set(k,v) },
      classList: { add: (...xs) => xs.forEach(x=>classes.add(x)), remove: (...xs)=>xs.forEach(x=>classes.delete(x)), toggle: (x,b)=>b?classes.add(x):classes.delete(x) },
      addEventListener: (k,v)=>events.set(k,v),
      getBoundingClientRect: ()=>({left:0,top:0,width:400,height:600}),
      fire(k,v={}) { events.get(k)?.(v); }
    };
  };
  const hero=make(), visual=make(), target=make(), year=make(), root=make(), stage=make(), toggle=make(), state=make();
  const motion={...make(),matches:reduced}, pointer={...make(),matches:fine};
  const doc={...make(), hidden:false, documentElement:root, getElementById:()=>year,
    querySelector: s=>({"[data-hero]":hero,"[data-hero-visual]":visual,"[data-character-parallax]":target,"[data-character-stage]":stage,"[data-motion-toggle]":toggle,"[data-motion-state]":state}[s]??null)};
  const frames=new Map(); let seq=0, observer;
  vm.runInNewContext(source,{
    document:doc, window:{ matchMedia:q=>q.includes("reduced")?motion:pointer },
    requestAnimationFrame:cb=>{frames.set(++seq,cb);return seq;},
    cancelAnimationFrame:id=>frames.delete(id),
    IntersectionObserver:class {constructor(cb){observer=cb;} observe(){}},
    Date, Math
  });
  return {hero,visual,target,doc,motion,pointer,frames,toggle,state,
    move:()=>hero.fire("pointermove",{pointerType:"mouse",clientX:380,clientY:100}),
    flush(){for(const [id,cb] of [...frames]){frames.delete(id);cb();}},
    intersection(visible){observer?.([{isIntersecting:visible}]);}
  };
}
test("pointer input is batched and capped",()=>{
 const h=harness(); for(let i=0;i<20;i++)h.move();
 assert.equal(h.frames.size,1); h.flush();
 assert.ok(Math.abs(parseFloat(h.target.props.get("--parallax-x")))>0);
 assert.ok(Math.abs(parseFloat(h.target.props.get("--parallax-x")))<=10);
});
test("leaving cancels pending frame and keeps the neutral pose",()=>{
 const h=harness(); h.move(); h.hero.fire("pointerleave"); h.flush();
 assert.equal(h.frames.size,0);
 assert.equal(parseFloat(h.target.props.get("--parallax-x")),0);
});
test("motion disabled at startup can be enabled without reloading",()=>{
 const h=harness({reduced:true}); h.move(); assert.equal(h.frames.size,0);
 h.motion.matches=false; h.motion.fire("change"); h.move(); h.flush();
 assert.notEqual(parseFloat(h.target.props.get("--parallax-x")),0);
});
test("switching reduced motion on resets and cancels pointer updates",()=>{
 const h=harness();h.move();h.flush();h.move();
 h.motion.matches=true;h.motion.fire("change");h.flush();
 assert.equal(h.frames.size,0);assert.equal(parseFloat(h.target.props.get("--parallax-x")),0);
 h.move();assert.equal(h.frames.size,0);
});
test("touch and coarse-pointer devices do not run parallax",()=>{
 const h=harness(); h.hero.fire("pointermove",{pointerType:"touch",clientX:380,clientY:100});
 assert.equal(h.frames.size,0);
 const coarse=harness({fine:false});coarse.move();assert.equal(coarse.frames.size,0);
});
test("hidden tab and offscreen hero stop work and resume safely",()=>{
 const h=harness();h.move();h.doc.hidden=true;h.doc.fire("visibilitychange");h.flush();
 assert.equal(h.frames.size,0);h.move();assert.equal(h.frames.size,0);
 h.doc.hidden=false;h.doc.fire("visibilitychange");
 h.intersection(false);h.move();assert.equal(h.frames.size,0);
 h.intersection(true);h.move();assert.equal(h.frames.size,1);
});

test("explicit toggle opts into motion while preserving reduced-motion default",()=>{
 const h=harness({reduced:true});
 assert.equal(h.toggle.hidden,false);
 assert.equal(h.toggle.props.get("aria-pressed"),"false");
 h.toggle.fire("click"); h.move(); h.flush();
 assert.equal(h.toggle.props.get("aria-pressed"),"true");
 assert.ok(h.hero.classes.has("motion-enabled"));
 assert.notEqual(parseFloat(h.target.props.get("--parallax-x")),0);
});
test("turning effects off cancels pending work and user choice persists for this visit",()=>{
 const h=harness(); h.move(); h.toggle.fire("click"); h.flush();
 assert.equal(h.frames.size,0);
 assert.equal(h.toggle.props.get("aria-pressed"),"false");
 assert.ok(h.hero.classes.has("motion-disabled"));
 h.motion.matches=true;h.motion.fire("change");h.motion.matches=false;h.motion.fire("change");
 h.move();assert.equal(h.frames.size,0);
});
test("manual effects still respect hidden tab and coarse pointer",()=>{
 const h=harness({reduced:true,fine:false});h.toggle.fire("click");h.move();
 assert.equal(h.frames.size,0);
 h.doc.hidden=true;h.doc.fire("visibilitychange");
 assert.ok(h.hero.classes.has("is-paused"));
});
