import type { Metadata } from 'next';
import CommandCenterClient from './CommandCenterClient';

export const metadata: Metadata = {
  title: 'Predictive Command Center | SevaSetu AI',
  description: 'Visualize urgency, staffing readiness, and AI-backed volunteer dispatch recommendations.',
};

export default function CommandCenterPage() {
  return <CommandCenterClient />;
}
