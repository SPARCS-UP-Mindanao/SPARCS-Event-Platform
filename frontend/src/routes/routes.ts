import { createBrowserRouter } from 'react-router-dom';
import ErrorPage from '@/components/ErrorPage';
import AdminPage from '@/pages/admin/AdminPage';
import AdminAuthorityPage from '@/pages/admin/authority/AdminAuthorityPage';
import AdminAllEventsPage from '@/pages/admin/event/allEvents/AdminAllEventsPage';
import AdminEventEvaluationsPage from '@/pages/admin/event/evaluations/AdminEventEvaluationsPage';
import AdminEventPage from '@/pages/admin/event/event/AdminEventPage';
import AdminEventRegistrationsPage from '@/pages/admin/event/registrations/AdminEventRegistrationsPage';
import AdminLoginPage from '@/pages/admin/login/AdminLoginPage';
import EvaluatePage from '@/pages/evaluate/EvaluatePage';
import RegisterPage from '@/pages/register/RegisterPage';
import App from '@/App';
import AdminEvaluationsPage from '@/pages/admin/evaluations/AdminEvaluationsPage';

export const routes = createBrowserRouter(
  [
    {
      path: '/',
      element: App(),
      children: [
        {
          path: ':eventId',
          children: [
            {
              path: 'register',
              element: RegisterPage()
            },
            {
              path: 'evaluate',
              element: EvaluatePage()
            }
          ]
        }
      ]
    },
    {
      path: '/admin/login',
      element: AdminLoginPage()
    },
    {
      path: '/admin/events',
      element: AdminPage(),
      children: [
        {
          index: true,
          element: AdminAllEventsPage()
        },
        {
          path: ':eventId',
          element: AdminEventPage(),
          children: [
            {
              path: 'registrations',
              element: AdminEventRegistrationsPage()
            },
            {
              path: 'evaluations',
              element: AdminEventEvaluationsPage()
            }
          ]
        }
      ]
    },
    {
      path: '/admin/evaluations',
      element: AdminEvaluationsPage()
    },
    {
      path: 'admin/authority',
      element: AdminAuthorityPage()
    },
    {
      path: '*',
      element: ErrorPage({})
    }
  ],
  {
    basename: import.meta.env.VITE_STAGE === 'prod' ? '/events' : '/'
  }
);
