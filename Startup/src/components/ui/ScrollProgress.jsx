import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * ScrollProgress Component (inspired by Animaster Library)
 * Renders an ultra-sleek, neon cyber emerald progress bar tracking page scroll.
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
      style={{
        scaleX,
        transformOrigin: '0%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #00ff88 0%, #39ff9e 50%, #ffffff 100%)',
        boxShadow: '0 0 14px rgba(0, 255, 136, 0.8), 0 0 4px rgba(0, 255, 136, 0.5)',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    />
  );
}
