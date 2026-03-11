import React from 'react';

const OMITTED_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'layout',
  'layoutId',
  'whileHover',
  'whileTap',
  'whileInView',
  'viewport',
  'variants',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragTransition',
]);

const componentCache = new Map<string, React.ComponentType<any>>();

function createMotionComponent(tagName: string) {
  const MotionComponent = React.forwardRef<any, any>((props, ref) => {
    const cleanProps: Record<string, unknown> = {};

    Object.entries(props || {}).forEach(([key, value]) => {
      if (key === 'children' || OMITTED_PROPS.has(key)) {
        return;
      }

      cleanProps[key] = value;
    });

    return React.createElement(tagName, { ...cleanProps, ref }, props?.children);
  });

  MotionComponent.displayName = `LightMotion(${tagName})`;
  return MotionComponent;
}

export const motion = new Proxy(
  {},
  {
    get(_target, property: string) {
      if (!componentCache.has(property)) {
        componentCache.set(property, createMotionComponent(property));
      }

      return componentCache.get(property);
    },
  }
) as Record<string, React.ComponentType<any>>;

export function AnimatePresence({ children }: { children?: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
