"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
}

const StarBorder = React.forwardRef<HTMLElement, StarBorderProps>(
  ({
    as: Component = 'div',
    className = '',
    color = 'magenta',
    speed = '6s',
    thickness = 6,
    children,
    ...rest
  }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('star-border-container', className)}
        style={{
          padding: `${thickness}px 2px`,
          ...rest.style
        }}
        {...rest}
      >
        <div
          className="border-gradient-bottom"
          style={{
            background: `radial-gradient(circle, ${color}, transparent 10%)`,
            animationDuration: speed
          }}
        ></div>
        <div
          className="border-gradient-top"
          style={{
            background: `radial-gradient(circle, ${color}, transparent 10%)`,
            animationDuration: speed
          }}
        ></div>
        <div className="inner-content">{children}</div>
      </Component>
    );
  }
);
StarBorder.displayName = 'StarBorder';

export default StarBorder;
