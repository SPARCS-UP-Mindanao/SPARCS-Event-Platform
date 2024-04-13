import { IconName } from '@/components/Icon';
import { UserGroup } from '@/model/auth';

export interface AdminRouteConfigProps {
  optionName: string;
  iconName: IconName;
  route?: string;
  location: 'upper' | 'lower';
  selected?: boolean;
  visible?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface Props {
  eventId?: string;
  userGroups?: UserGroup[];
  setLogoutOpen: (open: boolean) => void;
}

export const getAdminRouteConfig = ({ eventId, userGroups, setLogoutOpen }: Props): AdminRouteConfigProps[] => [
  {
    optionName: 'Dashboard',
    iconName: 'Home',
    route: '/admin/events',
    location: 'upper'
  },
  {
    optionName: 'Create event',
    iconName: 'Plus',
    visible: !eventId,
    route: '/admin/events/create',
    location: 'upper'
  },
  {
    optionName: 'Info',
    iconName: 'Info',
    visible: !!eventId,
    route: `/admin/events/${eventId}/`,
    location: 'upper'
  },
  {
    optionName: 'Registrations',
    iconName: 'User',
    visible: !!eventId,
    route: `/admin/events/${eventId}/registrations`,
    location: 'upper'
  },
  {
    optionName: 'Discounts',
    iconName: 'Coins',
    visible: !!eventId,
    route: `/admin/events/${eventId}/discounts`,
    location: 'upper'
  },
  {
    optionName: 'Evaluations',
    iconName: 'Clipboard',
    visible: !!eventId,
    route: `/admin/events/${eventId}/evaluations`,
    location: 'upper'
  },
  {
    optionName: 'FAQs',
    iconName: 'HelpCircle',
    visible: !!eventId,
    route: `/admin/events/${eventId}/faqs`,
    location: 'upper'
  },
  {
    optionName: 'Admins',
    iconName: 'Users',
    visible: userGroups && userGroups.includes('super_admin'),
    route: `/admin/authority`,
    location: 'lower'
  },
  {
    optionName: 'Sign out',
    iconName: 'LogOut',
    location: 'lower',
    onClick: () => setLogoutOpen(true)
  }
];
