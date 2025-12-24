"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { roleNavConfig, NavItem } from '@/config/roleNavConfig';
import { UserRole } from '@/types';

export function BottomNavBar() {
  const pathname = usePathname();
  const { userRole, loading } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (loading) return;

    let currentRole: UserRole = 'User';
    if (userRole && userRole.length > 0) {
      currentRole = userRole[0];
    }

    // Get items for role, or fallback
    const items = roleNavConfig[currentRole] || roleNavConfig['User'] || roleNavConfig['Default'];
    setNavItems(items);
  }, [userRole, loading]);

  useEffect(() => {
    if (navItems.length > 0) {
      // Find the active index based on the current path
      const index = navItems.findIndex(item =>
        item.pathPrefix && pathname.startsWith(item.pathPrefix)
      );
      // If found, set it, otherwise keep current or default to 0
      if (index !== -1) {
        setActiveIndex(index);
      }
    }
  }, [pathname, navItems]);

  const isActive = (pathPrefix: string) => {
    if (pathPrefix === '') return false;
    return pathname.startsWith(pathPrefix);
  };

  // SVG Configuration
  const totalItems = 5;
  // We use a relative coordinate system 0-500 width (100 per item)
  const itemWidth = 100;
  const height = 80;
  const curveWidth = 80; // Width of the notch
  const curveDepth = 45; // Depth of the notch (approx)

  // Generate the SVG Path for the "notch"
  // The notch moves based on activeIndex
  const pathD = useMemo(() => {
    const center = activeIndex * itemWidth + itemWidth / 2;
    const start = center - curveWidth / 2;
    const end = center + curveWidth / 2;

    // Smooth bezier curve for the notch
    // Using a "squircle" or smooth cut logic
    // M0,0 Lstart,0 ... curve down ... Lend,0 L500,0 L500,80 L0,80 Z

    return `M0,0 L${start - 15},0 
      Q${start},0 ${start + 10},15 
      Q${center},${curveDepth} ${end - 10},15 
      Q${end},0 ${end + 15},0 
      L500,0 L500,${height} L0,${height} Z`;
  }, [activeIndex]);

  if (loading || navItems.length === 0) return null;

  // We only support exactly 5 items for this specific animation geometry
  // If role has fewer/more, we might need to adjust logic, but config assumes 5.
  // We'll fill with empty placeholders if needed to keep geometry or just render what we have.
  const renderItems = navItems.slice(0, 5);

  return (
    <div className="fixed bottom-0 left-0 z-[9999] w-full h-20 md:hidden noprint pointer-events-none">
      <div className="relative w-full h-full pointer-events-auto">
        {/* Animated Background Shape */}
        <svg
          className="absolute top-0 left-0 w-full h-full drop-shadow-[0_-5px_10px_rgba(0,0,0,0.1)]"
          viewBox={`0 0 ${totalItems * itemWidth} ${height}`}
          preserveAspectRatio="none"
        >
          <motion.path
            d={pathD}
            fill="hsl(var(--card))" // Use theme card color
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            initial={false}
            animate={{ d: pathD }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </svg>

        {/* Floating Active Button Circle */}
        <motion.div
          className="absolute -top-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-4 border-background"
          style={{
            width: '56px',
            height: '56px',
            // Center calculations: (activeIndex * 20%) + 10% - halfCircleWidth
            left: `calc(${activeIndex * 20 + 10}% - 28px)`,
          }}
          animate={{
            left: `calc(${activeIndex * (100 / renderItems.length) + (100 / renderItems.length / 2)}% - 28px)`
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {navItems[activeIndex] && (
            <Link href={navItems[activeIndex].href} className="flex items-center justify-center w-full h-full">
              {React.createElement(navItems[activeIndex].icon, { className: "w-6 h-6" })}
            </Link>
          )}
        </motion.div>

        {/* Menu Items Container */}
        <div className="relative w-full h-full grid grid-cols-5 z-10">
          {renderItems.map((item, index) => {
            const Icon = item.icon;
            const active = index === activeIndex;

            return (
              <div key={`${item.label}-${index}`} className="flex flex-col items-center justify-end pb-4 pt-6 h-full cursor-pointer relative group">
                <Link href={item.href} className="w-full h-full flex flex-col items-center justify-end" onClick={() => setActiveIndex(index)}>
                  {/* Icon - only visible if NOT active (since active one floats) */}
                  {!active && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="mb-1"
                    >
                      <Icon className={cn("w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors")} />
                    </motion.div>
                  )}

                  {/* Label - visible mostly for active, or always? 
                      Design usually shows label for active item. 
                  */}
                  <motion.span
                    className={cn(
                      "text-[10px] font-medium transition-colors duration-200",
                      active ? "text-primary translate-y-[-4px]" : "text-muted-foreground"
                    )}
                    animate={{ y: active ? -4 : 0 }}
                  >
                    {item.label}
                  </motion.span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
