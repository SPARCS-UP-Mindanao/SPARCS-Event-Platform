import { FAQUpdateValues } from '@/api/events';
import { EventFormValues } from '@/hooks/useAdminEventForm';
import { FAQsFormValues } from '@/hooks/useFAQsForm';

export interface Event {
  name: string;
  description: string;
  email: string;
  startDate: string;
  endDate: string;
  venue: string;
  paidEvent: boolean;
  price: number;
  bannerLink: string | null;
  logoLink: string | null;
  certificateTemplate: string | null;
  status: EventStatus;
  eventId: string;
  isLimitedSlot: boolean;
  isApprovalFlow: boolean;
  registrationCount: number;
  maximumSlots: number | null;
  createDate?: string;
  updateDate?: string;
  createdBy?: string;
  updatedBy?: string;
  bannerUrl?: string;
  logoUrl?: string;
  certificateTemplateUrl?: string;
}

export type EventStatus = 'draft' | 'preregistration' | 'open' | 'cancelled' | 'closed' | 'completed';
type EventStatusItem = {
  value: EventStatus;
  label: string;
};

export const EVENT_STATUSES: EventStatusItem[] = [
  {
    value: 'draft',
    label: 'Draft'
  },
  {
    value: 'preregistration',
    label: 'Pre-registration'
  },
  {
    value: 'open',
    label: 'Open'
  },
  {
    value: 'cancelled',
    label: 'Cancelled'
  },
  {
    value: 'closed',
    label: 'Closed'
  },
  {
    value: 'completed',
    label: 'Completed'
  }
];

export const EVENT_UPLOAD_TYPES = {
  BANNER: 'banner',
  LOGO: 'logo',
  CERTIFICATE_TEMPLATE: 'certificateTemplate',
  PROOF_OF_PAYMENT: 'proofOfPayment',
  GCASH_QR: 'gcashQRCode'
};

export const EVENT_OBJECT_KEY_MAPS = {
  BANNER: 'bannerLink',
  LOGO: 'logoLink',
  CERTIFICATE_TEMPLATE: 'certificateTemplate',
  PROOF_OF_PAYMENT: 'proofOfPayment',
  GCASH_QR: 'gcashQRCode'
};

export type UploadType = keyof typeof EVENT_UPLOAD_TYPE;

export const enum EVENT_UPLOAD_TYPE {
  BANNER = 'banner',
  LOGO = 'logo',
  CERTIFICATE_TEMPLATE = 'certificateTemplate',
  PROOF_OF_PAYMENT = 'proofOfPayment',
  GCASH_QR = 'gcashQRCode'
}

export const enum EVENT_OBJECT_KEY_MAP {
  BANNER = 'bannerLink',
  LOGO = 'logoLink',
  CERTIFICATE_TEMPLATE = 'certificateTemplate',
  GCASH_PAYMENT = 'gcashPayment',
  GCASH_QR = 'gcashQRCode'
}

export type EventFAQs = {
  isActive: boolean;
  faqs: FAQ[];
};

export type FAQ = {
  id: string;
  question: string;
  answer: string;
};

export interface EventWithRefetchEvent extends Event {
  refetchEvent: () => void;
}

export const mapEventToFormValues = (event: Event): EventFormValues => ({
  name: event.name,
  description: event.description,
  email: event.email,
  startDate: event.startDate,
  endDate: event.endDate,
  venue: event.venue,
  paidEvent: event.paidEvent,
  price: event.price,
  status: event.status,
  bannerLink: event.bannerLink || undefined,
  logoLink: event.logoLink || undefined,
  certificateTemplate: event.certificateTemplate || undefined,
  isLimitedSlot: event.isLimitedSlot,
  isApprovalFlow: event.isApprovalFlow || false,
  maximumSlots: event.maximumSlots || undefined
});

export interface CreateEvent {
  name: string;
  description: string;
  email: string;
  startDate: string;
  endDate: string;
  venue: string;
  paidEvent: boolean;
  price: number;
  bannerLink: string | null;
  logoLink: string | null;
  certificateTemplate: string | null;
  isLimitedSlot: boolean;
  isApprovalFlow: boolean;
  maximumSlots: number | null;
  status: EventStatus;
}

export const mapCreateEventValues = (values: EventFormValues): CreateEvent => ({
  name: values.name,
  description: values.description,
  email: values.email,
  startDate: values.startDate,
  endDate: values.endDate,
  venue: values.venue,
  paidEvent: values.paidEvent,
  price: values.paidEvent ? values.price : 0,
  status: values.status,
  maximumSlots: values.maximumSlots || null,
  isLimitedSlot: values.isLimitedSlot,
  isApprovalFlow: values.isApprovalFlow,
  bannerLink: values.bannerLink || null,
  logoLink: values.logoLink || null,
  certificateTemplate: values.certificateTemplate || null
});

export const removeFAQIds = (value: FAQsFormValues): FAQUpdateValues => {
  const faqsWithNoId =
    value.faqs?.map((faq) => ({
      question: faq.question,
      answer: faq.answer
    })) ?? [];
  return { ...value, faqs: faqsWithNoId };
};
