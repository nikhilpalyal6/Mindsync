import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * ScrollProgress Component (inspired by Animaster Library)
 * Renders an ultra-sleek, neon cyber emerald progress bar tracking page scroll.
 * Adapts dynamically between Dark and Light themes.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="global-scroll-progress"
      style={{
        scaleX,
        transformOrigin: '0%',
      }}
    />
  );
}
