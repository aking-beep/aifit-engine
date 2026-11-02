import { arcLinks } from '@/design';

/** ARC Transformation Group links for this deployment (overridable per environment). */
export const ARC_LINKS = arcLinks({ site: process.env.NEXT_PUBLIC_ARC_SITE_URL, booking: process.env.NEXT_PUBLIC_ARC_BOOKING_URL });
