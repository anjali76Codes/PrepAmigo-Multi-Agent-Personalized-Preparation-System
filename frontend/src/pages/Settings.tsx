import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function Settings() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-4xl mx-auto w-full space-y-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-secondary-text text-lg">
            Manage your preferences and travel profile.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Profile Section */}
          <motion.section variants={itemVariants}>
            <h2 className="text-lg font-bold text-primary-text mb-4 px-2">Profile</h2>
            <Card className="p-6 rounded-3xl border-border bg-elevated/40 backdrop-blur-sm divide-y divide-border">
              <div className="flex items-center justify-between py-4 first:pt-0">
                <div>
                  <p className="font-medium text-primary-text">Name</p>
                  <p className="text-sm text-secondary-text">Krisha Cherry</p>
                </div>
                <Button variant="secondary" className="rounded-full px-4 text-sm">Edit</Button>
              </div>
              <div className="flex items-center justify-between py-4 pb-0">
                <div>
                  <p className="font-medium text-primary-text">Email</p>
                  <p className="text-sm text-secondary-text">krisha.cherry@example.com</p>
                </div>
                <Button variant="secondary" className="rounded-full px-4 text-sm">Edit</Button>
              </div>
            </Card>
          </motion.section>

          {/* Travel Preferences */}
          <motion.section variants={itemVariants}>
            <h2 className="text-lg font-bold text-primary-text mb-4 px-2">Travel Preferences</h2>
            <Card className="p-6 rounded-3xl border-border bg-elevated/40 backdrop-blur-sm divide-y divide-border">
              <div className="flex items-center justify-between py-4 first:pt-0">
                <div>
                  <p className="font-medium text-primary-text">Travel Style</p>
                  <p className="text-sm text-secondary-text">Balanced (Culture & Relaxation)</p>
                </div>
                <Icon name="chevron-forward-outline" className="text-secondary-text" />
              </div>
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-primary-text">Food Preferences</p>
                  <p className="text-sm text-secondary-text">Vegetarian</p>
                </div>
                <Icon name="chevron-forward-outline" className="text-secondary-text" />
              </div>
              <div className="flex items-center justify-between py-4 pb-0">
                <div>
                  <p className="font-medium text-primary-text">Accommodation</p>
                  <p className="text-sm text-secondary-text">Boutique Hotels, 4+ Stars</p>
                </div>
                <Icon name="chevron-forward-outline" className="text-secondary-text" />
              </div>
            </Card>
          </motion.section>

          {/* Notifications & Appearance */}
          <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-bold text-primary-text mb-4 px-2">Notifications</h2>
              <Card className="p-6 rounded-3xl border-border bg-elevated/40 backdrop-blur-sm space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium">Trip Updates</span>
                  <div className="w-10 h-6 bg-accent rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-background rounded-full" />
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium">Booking Changes</span>
                  <div className="w-10 h-6 bg-accent rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-background rounded-full" />
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium">Important Alerts</span>
                  <div className="w-10 h-6 bg-accent rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-background rounded-full" />
                  </div>
                </label>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-bold text-primary-text mb-4 px-2">Appearance</h2>
              <Card className="p-6 rounded-3xl border-border bg-elevated/40 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Theme</span>
                  <span className="text-sm text-secondary-text flex items-center gap-1">
                    Dark <Icon name="moon-outline" className="ml-1" />
                  </span>
                </div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium">Reduced Motion</span>
                  <div className="w-10 h-6 bg-surface-elevated rounded-full relative border border-border">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-secondary-text rounded-full" />
                  </div>
                </label>
              </Card>
            </div>
          </motion.section>

        </motion.div>
      </div>
    </div>
  );
}
