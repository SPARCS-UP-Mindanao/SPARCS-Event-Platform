import { FC, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormProvider } from 'react-hook-form';
import ErrorPage from '@/components/ErrorPage';
import { FormDescription, FormError, FormItem, FormItemContainer, FormLabel } from '@/components/Form';
import Input from '@/components/Input';
import Separator from '@/components/Separator';
import Stepper from '@/components/Stepper';
import { Event } from '@/model/events';
import { RegisterMode } from '@/model/registrations';
import {
  REGISTER_FIELDS,
  REGISTER_FIELDS_WITH_PREREGISTRATION,
  REGISTER_FIELDS_WITH_TICKET_TYPE_AWS,
  RegisterField,
  useRegisterForm
} from '@/hooks/useRegisterForm';
import EventDetails from './EventDetails';
import EventHeader from './EventHeader';
import FAQs from './FAQs';
import RegisterFormLoading from './RegisterFormSkeleton';
import RegisterFooter from './footer/RegisterFooter';
import PaymentStep from './steps/PaymentStep';
import PersonalInfoStep from './steps/PersonalInfoStep';
import {
  PreRegisterSteps,
  RegisterStep,
  RegisterSteps,
  RegisterStepsWithPayment,
  RegisterStepsPaymentOnly,
  STEP_EVENT_DETAILS,
  STEP_SUCCESS
} from './steps/RegistrationSteps';
import SuccessStep from './steps/SuccessStep';
import SummaryStep from './steps/SummaryStep';
import UserBioStep from './steps/UserBioStep';
import { useRegisterPage } from './useRegisterPage';
import { useSuccess } from './useSuccess';

interface Props {
  mode?: RegisterMode;
}

const Register: FC<Props> = ({ mode = 'register' }) => {
  const { eventId } = useParams();

  const navigateOnSuccess = () => setCurrentStep(STEP_SUCCESS);

  const [currentStep, setCurrentStep] = useState<RegisterStep>(STEP_EVENT_DETAILS);
  const [eventInfo, setEventInfo] = useState<Event | null>(null);
  const [isTransactionFeeLoading, setIsTransactionFeeLoading] = useState(false);

  const isConference = eventInfo?.email === 'hello@awsugdavao.ph';
  const { form, onSubmit } = useRegisterForm(eventId!, mode, navigateOnSuccess, isConference);
  const { response, isFetching } = useRegisterPage(eventId!, setCurrentStep);
  const { isSuccessLoading, isRegisterSuccessful, retryRegister } = useSuccess(currentStep, form.getValues, onSubmit);

  const updateEventPrice = (newPrice: number) => {
    if (eventInfo) {
      setEventInfo({ ...eventInfo, price: newPrice });
    }
  };

  if (isFetching) {
    return <RegisterFormLoading />;
  }

  if (!response || (response && !response.data && response.errorData)) {
    return <ErrorPage error={response} />;
  }

  if (!eventInfo) {
    setEventInfo(response.data);
    return null;
  }

  if (eventInfo.status === 'draft' || (mode === 'register' && eventInfo.status === 'preregistration')) {
    return <ErrorPage />;
  }

  if (mode === 'preregister' && eventInfo.status !== 'preregistration') {
    return (
      <ErrorPage
        errorTitle="Pre-registrations closed"
        message={`Pre-registrations for ${eventInfo.name} is now closed. If you have already pre-registered, please check your email for more information about the event.`}
      />
    );
  }

  if (mode === 'register' && eventInfo.maximumSlots && eventInfo.maximumSlots === eventInfo.registrationCount) {
    return (
      <ErrorPage
        errorTitle="Slots are full"
        message={`Thank you for your interest but ${eventInfo.name} has already reached its maximum slots for participants.`}
      />
    );
  }

  if (eventInfo.status === 'closed') {
    return <ErrorPage errorTitle="Sold Out" message={`Thank you for your interest but ${eventInfo.name} is no longer open for registration.`} />;
  }

  if (eventInfo.status === 'cancelled') {
    const errorTitle = `${eventInfo.name} is Cancelled`;
    return (
      <ErrorPage
        errorTitle={errorTitle}
        message={`We've had to cancel, but please follow us on social media for future news. Sorry for the inconvenience, and thank you for your support!`}
      />
    );
  }

  if (eventInfo.status === 'completed') {
    return <ErrorPage errorTitle="Registration is Closed" message={`Thank you for your interest but ${eventInfo.name} is no longer open for registration.`} />;
  }

  if (isSuccessLoading) {
    return <RegisterFormLoading />;
  }

  const getSteps = () => {
    if (eventInfo.isApprovalFlow && eventInfo.status === 'preregistration') {
      return PreRegisterSteps;
    }

    if (eventInfo.isApprovalFlow && eventInfo.status === 'open') {
      return RegisterStepsPaymentOnly;
    }

    if (eventInfo.paidEvent) {
      return RegisterStepsWithPayment;
    }

    return RegisterSteps;
  };

  const getFieldsToCheck = () => {
    if (eventInfo.isApprovalFlow && eventInfo.status === 'open') {
      return REGISTER_FIELDS_WITH_PREREGISTRATION;
    }

    if (isConference) {
      return REGISTER_FIELDS_WITH_TICKET_TYPE_AWS;
    }

    return REGISTER_FIELDS;
  };

  const fieldsToCheck: RegisterField[] = getFieldsToCheck()[currentStep.id] || [];
  const STEPS = getSteps();
  const showStepper = currentStep.id !== 'EventDetails' && currentStep.id !== 'Success';
  const showFAQs = currentStep.id === 'EventDetails';

  return (
    <section className="flex flex-col items-center px-4">
      <div className="w-full max-w-2xl flex flex-col items-center space-y-4">
        <EventHeader event={eventInfo} />

        <FormProvider {...form}>
          <main className="w-full">
            {currentStep.id !== 'EventDetails' && <h1 className="text-xl text-center">{currentStep.title}</h1>}

            {showStepper && <Stepper steps={STEPS} currentStep={currentStep} stepsToExclude={[STEP_SUCCESS]} />}

            <div className="space-y-4">
              {currentStep.id === 'EventDetails' && <EventDetails event={eventInfo} />}
              {currentStep.id === 'UserBio' && <UserBioStep />}
              {currentStep.id === 'PersonalInfo' && <PersonalInfoStep event={eventInfo} updateEventPrice={updateEventPrice} />}
              {currentStep.id === 'Payment' && <PaymentStep eventPrice={eventInfo.price} setIsTransactionFeeLoading={setIsTransactionFeeLoading} />}
            </div>

            {currentStep.id === 'Summary' && <SummaryStep event={eventInfo} />}
            {currentStep.id === 'Success' && <SuccessStep event={eventInfo} isRegisterSuccessful={isRegisterSuccessful} />}
            {currentStep.id !== 'EventDetails' && currentStep.id !== 'Success' && <Separator className="my-4" />}

            {currentStep.id === 'EventDetails' && eventInfo.isApprovalFlow && eventInfo.status === 'open' && (
              <FormItem name="email">
                {({ field }) => (
                  <FormItemContainer className="px-0 my-6">
                    <FormLabel>Email</FormLabel>
                    <Input type="email" {...field} />
                    <FormDescription>Enter the email address you used for pre-registering</FormDescription>
                    <FormError />
                  </FormItemContainer>
                )}
              </FormItem>
            )}

            <RegisterFooter
              event={eventInfo}
              steps={STEPS}
              currentStep={currentStep}
              fieldsToCheck={fieldsToCheck}
              isRegisterSuccessful={isRegisterSuccessful}
              retryRegister={retryRegister}
              setCurrentStep={setCurrentStep}
              isTransactionFeeLoading={isTransactionFeeLoading}
            />

            {showFAQs && <FAQs />}
          </main>
        </FormProvider>
      </div>
    </section>
  );
};

export default Register;
