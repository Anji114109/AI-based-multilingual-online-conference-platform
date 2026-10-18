import React, { useEffect } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "motion/react";

const getRotationTransition = (duration, from, loop = true) => ({
  from,
  to: from - 360,
  ease: "linear",
  duration,
  type: "tween",
  repeat: loop ? Infinity : 0,
});

const getTransition = (duration, from) => ({
  rotate: getRotationTransition(duration, from),
  scale: {
    type: "spring",
    damping: 20,
    stiffness: 300,
  },
});

const CircularFeatureOrbit = ({
  features,
  centerContent,
  spinDuration = 34,
  onHover = "speedUp",
  radius = 250,
  cardWidth = 220,
  cardPadding = 24,
  className = "",
}) => {
  const controls = useAnimation();
  const rotation = useMotionValue(0);
  const counterRotate = useTransform(rotation, (value) => -value);

  useEffect(() => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start),
    });
  }, [spinDuration, onHover, controls, rotation]);

  const handleHoverStart = () => {
    if (!onHover) return;
    const start = rotation.get();

    let transitionConfig = getTransition(spinDuration, start);
    let scaleVal = 1;

    if (onHover === "slowDown") {
      transitionConfig = getTransition(spinDuration * 2, start);
    } else if (onHover === "speedUp") {
      transitionConfig = getTransition(Math.max(10, spinDuration / 2), start);
    } else if (onHover === "pause") {
      transitionConfig = {
        rotate: { type: "spring", damping: 20, stiffness: 300 },
        scale: { type: "spring", damping: 20, stiffness: 300 },
      };
    } else if (onHover === "goBonkers") {
      transitionConfig = getTransition(Math.max(3, spinDuration / 10), start);
      scaleVal = 0.96;
    }

    controls.start({
      rotate: start + 360,
      scale: scaleVal,
      transition: transitionConfig,
    });
  };

  const handleHoverEnd = () => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start),
    });
  };

  return (
    <div className={`button-features-container ${className}`.trim()}>
      {centerContent}

      <motion.div
        className="features-orbit-ring"
        style={{ rotate: rotation }}
        initial={{ rotate: 0 }}
        animate={controls}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
      >
        {features.map((feature, index) => {
          const angle = (2 * Math.PI * index) / features.length - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={feature.id}
              className="feature-card orbit-feature-card"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                animationDelay: `${0.1 + index * 0.08}s`,
                "--orbit-card-width": `${cardWidth}px`,
                "--orbit-card-padding": `${cardPadding}px`,
                rotate: counterRotate,
              }}
            >
              <div className="feature-icon">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="feature-image"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.description}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default CircularFeatureOrbit;
