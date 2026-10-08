import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Mascot } from '../ui/Mascot';
import { Reveal, RevealStagger, RevealStaggerItem } from '../ui/Reveal';

type Mood = 'idle' | 'think' | 'cheer';

// true  = cards stay once they appear (1, 12, 123, 1234) and reverse on scroll up
// false = each card fades out before the next one appears
const KEEP_VISIBLE = true;

const STEPS: {
  step: string;
  title: string;
  desc: string;
  card: string; // card background + title color
  descColor: string; // description color
  badge: string; // number circle
  x: string;
  y: string;
  mood: Mood;
}[] = [
    {
      step: '1',
      title: 'Input',
      desc: 'Tell us your target role and upload your resume.',
      card: 'bg-deep-emerald text-white',
      descColor: 'text-on-chrome-muted',
      badge: 'bg-chrome-accent text-deep-emerald',
      x: '14.6%',
      y: '14.6%',
      mood: 'idle',
    },
    {
      step: '2',
      title: 'Analyze',
      desc: 'Our agents find company expectations and your skill gaps.',
      card: 'bg-lavender-100 text-deep-emerald',
      descColor: 'text-cocoa',
      badge: 'bg-deep-emerald text-white',
      x: '85.4%',
      y: '14.6%',
      mood: 'think',
    },
    {
      step: '3',
      title: 'Plan',
      desc: 'We generate a day-by-day study roadmap.',
      card: 'bg-cocoa text-white',
      descColor: 'text-white/85',
      badge: 'bg-white text-deep-emerald',
      x: '85.4%',
      y: '85.4%',
      mood: 'idle',
    },
    {
      step: '4',
      title: 'Adapt',
      desc: 'The plan shifts based on your quiz scores and missed days.',
      card: 'bg-chrome-accent text-deep-emerald',
      descColor: 'text-cocoa',
      badge: 'bg-deep-emerald text-white',
      x: '14.6%',
      y: '85.4%',
      mood: 'cheer',
    },
  ];

const SLICE = 1 / STEPS.length;

function StepBody({ data }: { data: (typeof STEPS)[number] }) {
  return (
    <>
      <div
        className={`absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full text-xl font-bold shadow-card ring-4 ring-bg ${data.badge}`}
      >
        {data.step}
      </div>
      <h3 className="mb-2 text-xl font-bold">{data.title}</h3>
      <p className={`text-sm leading-relaxed ${data.descColor}`}>{data.desc}</p>
    </>
  );
}

function StepCard({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  const s = index * SLICE;
  const stays = index === STEPS.length - 1 || KEEP_VISIBLE;
  const data = STEPS[index];

  const keys = stays
    ? [s, s + 0.05, 1]
    : [s, s + 0.05, s + SLICE - 0.05, s + SLICE];

  const opacity = useTransform(progress, keys, stays ? [0, 1, 1] : [0, 1, 1, 0]);
  const y = useTransform(progress, keys, stays ? [40, 0, 0] : [40, 0, 0, -40]);
  const scale = useTransform(progress, keys, stays ? [0.85, 1, 1] : [0.85, 1, 1, 0.85]);
  const filter = useTransform(
    progress,
    keys,
    stays
      ? ['blur(8px)', 'blur(0px)', 'blur(0px)']
      : ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(8px)']
  );

  return (
    // Outer div = static position. Inner motion.div = scroll animation.
    <div
      style={{ ['--x' as string]: data.x, ['--y' as string]: data.y }}
      className="pointer-events-none absolute left-1/2 top-full mt-10 w-72 max-w-[85vw] -translate-x-1/2 md:left-[var(--x)] md:top-[var(--y)] md:mt-0 md:w-[17rem] md:-translate-y-1/2"
    >
      <motion.div style={{ opacity, y, scale, filter }}>
        <div
          className={`relative rounded-[2rem] px-7 pb-8 pt-10 text-center shadow-pop ${data.card}`}
        >
          <StepBody data={data} />
        </div>
      </motion.div>
    </div>
  );
}

function RingMarker({ index, active }: { index: number; active: number }) {
  const data = STEPS[index];
  const on = KEEP_VISIBLE ? index <= active : index === active;
  return (
    <div
      style={{ ['--x' as string]: data.x, ['--y' as string]: data.y }}
      className="absolute hidden -translate-x-1/2 -translate-y-1/2 md:left-[var(--x)] md:top-[var(--y)] md:block"
    >
      <motion.div
        animate={{ scale: on ? 1.4 : 1, opacity: on ? 1 : 0.35 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="h-3 w-3 rounded-full bg-deep-emerald ring-4 ring-bg"
      />
    </div>
  );
}

export function ScrollSteps() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 180]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  const goToStep = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + range * (i * SLICE + SLICE / 2), behavior: 'smooth' });
  };

  // Reduced motion: no pinning, plain stacked grid
  if (reduceMotion) {
    return (
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-12 text-center text-3xl font-bold text-deep-emerald">
          How PrepAmigo Works
        </h2>
        <RevealStagger className="grid gap-6 pt-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <RevealStaggerItem key={s.step}>
              <div
                className={`relative h-full rounded-[2rem] px-7 pb-8 pt-10 text-center shadow-card ${s.card}`}
              >
                <StepBody data={s} />
              </div>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative z-10 h-[220vh] md:h-[260vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center">
        <Reveal className="absolute left-0 right-0 top-16 px-6 text-center">
          <h2 className="text-3xl font-bold text-deep-emerald mt-14">How PrepAmigo Works</h2>
        </Reveal>

        {/* Stage: cards sit ON the circumference of the ring */}
        <div className="relative -mt-24 h-60 w-60 md:mt-10 md:h-[540px] md:w-[540px]">
          <motion.div
            style={{ rotate: ringRotate }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-soft-rose/40"
          />

          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <Mascot
              size="xl"
              variant={STEPS[active].mood === "cheer" ? "Celebration.png" : STEPS[active].mood === "think" ? "Thinking.png" : "Chilling.png"}
              className=""
            />
          </div>

          {STEPS.map((_, i) => (
            <RingMarker key={i} index={i} active={active} />
          ))}

          {STEPS.map((_, i) => (
            <StepCard key={i} index={i} progress={scrollYProgress} />
          ))}
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-6 flex gap-3">
          {STEPS.map((s, i) => (
            <button
              key={s.step}
              type="button"
              aria-label={`Go to step ${s.step}: ${s.title}`}
              onClick={() => goToStep(i)}
              className={`h-3 w-3 rounded-full border-2 border-deep-emerald transition-colors ${i === active ? 'bg-deep-emerald' : 'bg-transparent'
                }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}