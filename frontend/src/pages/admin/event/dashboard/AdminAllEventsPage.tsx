import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCookie } from 'typescript-cookie';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/Accordion';
import { getAdminEvents } from '@/api/events';
import { Event } from '@/model/events';
import { cn } from '@/utils/classes';
import { useApiQuery } from '@/hooks/useApi';
import { useDashboardEvents } from '@/hooks/useDashboardEvents';
import EventCard from '../../../../components/EventCard/EventCard';
import AdminAllEventsPageSkeleton from './AdminAllEventsPageSkeleton';

const AdminAllEvents = () => {
  const adminId = getCookie('_auth_user');
  const { data: response, isFetching, refetch } = useApiQuery(getAdminEvents(adminId!));

  if (isFetching) {
    return <AdminAllEventsPageSkeleton />;
  }

  if (!response || (response && response.status !== 200)) {
    return (
      // TODO: Add event not found page
      <div className="py-10">
        <h1>No Events Found</h1>
      </div>
    );
  }

  const events: Event[] = response.data;
  return <DashboardContent events={events} refetch={refetch} />;
};

interface DashboardProps {
  events: Event[];
  refetch: () => void;
}

const DashboardContent: FC<DashboardProps> = ({ events, refetch }) => {
  const navigate = useNavigate();
  const viewEvent = (eventId?: string) => () => navigate(`${eventId}/`);

  const dashboardEvents = useDashboardEvents(events);
  const defaultOpen = useMemo(
    () =>
      dashboardEvents
        .filter((category) => {
          if (category.events.length) {
            if (category.id === 'past-events') {
              return;
            }

            return category.id;
          }
        })
        .map((category) => category.id),
    [dashboardEvents]
  );

  const getEventCount = (event: Event[]) => (event.length ? event.length : 'No');

  return (
    <div className="flex flex-col w-full h-full space-y-6 overflow-auto">
      <h2 className="text-primary-900">Dashboard</h2>

      <div>
        <span className="font-bold text-primary-700 text-base rounded-md border border-primary p-2">
          <span className="text-primary-400">{events.length}</span> Events
        </span>
      </div>

      <Accordion type="multiple" defaultValue={defaultOpen}>
        {dashboardEvents.map((category) => (
          <AccordionItem value={category.id} key={category.id} disabled={!category.events.length}>
            <AccordionTrigger className={cn(category.events.length && 'font-bold')}>
              <div className="inline-flex space-x-1">
                <p className={cn('text-xl hover:!no-underline', category.events.length && 'text-primary-400')}>{getEventCount(category.events)}</p>
                <p className={cn('text-xl')}>{category.name}</p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap justify-center sm:justify-normal px-7 sm:px-0 gap-x-4 gap-y-4">
                {category.events.map((event) => (
                  <EventCard key={event.eventId} event={event} refetch={refetch} onClick={viewEvent(event.eventId)} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

const AdminAllEventsPage = () => {
  return <AdminAllEvents />;
};

export const Component = AdminAllEventsPage;

export default AdminAllEventsPage;
