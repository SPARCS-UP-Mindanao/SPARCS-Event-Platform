import { useState } from 'react';
import { useFormContext, UseFormSetValue, useWatch } from 'react-hook-form';
import { getEventRegCountStatus } from '@/api/events';
import { checkPreRegistration } from '@/api/preregistrations';
import { getEventRegistrationWithEmail } from '@/api/registrations';
import { Event } from '@/model/events';
import { AcceptanceStatus, PreRegistration, mapPreRegistrationToFormValues } from '@/model/preregistrations';
import { baseUrl, isEmpty, reloadPage, scrollToView } from '@/utils/functions';
import { useApi } from '@/hooks/useApi';
import { useNotifyToast } from '@/hooks/useNotifyToast';
import { RegisterField, RegisterFormValues } from '@/hooks/useRegisterForm';
import { calculateTotalPrice } from '../pricing';
import { RegisterStep, STEP_PAYMENT, STEP_SUCCESS } from '../steps/RegistrationSteps';
import { usePayment } from '../usePayment';

export const useRegisterFooter = (
  event: Event,
  steps: RegisterStep[],
  currentStep: RegisterStep,
  fieldsToCheck: RegisterField[],
  setCurrentStep: (step: RegisterStep) => void
) => {
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const { errorToast } = useNotifyToast();
  const { trigger, setValue, getValues, control, reset } = useFormContext<RegisterFormValues>();
  const api = useApi();
  const { eventId } = event;
  const [paymentChannel, paymentMethod, transactionFee, percentageDiscount] = useWatch({
    control,
    name: ['paymentChannel', 'paymentMethod', 'transactionFee', 'discountPercentage']
  });

  const { eWalletRequest, directDebitRequest } = usePayment(baseUrl, eventId);

  const currentIndex = steps.indexOf(currentStep);

  const paymentButtonDisabled = isEmpty(paymentChannel) || isEmpty(paymentMethod) || isEmpty(transactionFee);

  const validateEmail = async () => {
    const email = getValues('email');

    try {
      setIsValidatingEmail(true);
      const response =
        event.status === 'preregistration'
          ? await api.execute(checkPreRegistration(eventId, email))
          : await api.execute(getEventRegistrationWithEmail(eventId, email));
      switch (response.status) {
        case 200:
          errorToast({
            title: 'Email already registered',
            description: 'The email you entered has already been used. Please enter a different email.'
          });
          return false;
        case 404:
          return true;
        default:
          errorToast({
            title: 'Please try again',
            description: 'There was an error. Please try again.'
          });
          return false;
      }
    } catch (error) {
      errorToast({
        title: 'Please try again',
        description: 'There was an error. Please try again.'
      });
      return false;
    } finally {
      setIsValidatingEmail(false);
    }
  };

  const checkRegistrationCount = async () => {
    const response = await api.execute(getEventRegCountStatus(eventId));
    if (response.status !== 200) {
      throw new Error('Registration count check failed');
    }

    const { registrationCount, maximumSlots } = response.data;

    if (maximumSlots && maximumSlots === registrationCount) {
      return true;
    }

    return false;
  };

  const checkAcceptanceStatus = (preRegistration: PreRegistration) => {
    const getTitleAndDescription = (acceptanceStatus: AcceptanceStatus) => {
      if (acceptanceStatus === 'REJECTED') {
        return {
          title: 'Your pre-registration was not accepted',
          description: `We're sorry but your registration wasn't accepted. Please feel free to join our future events.`
        };
      }

      if (acceptanceStatus === 'PENDING') {
        return {
          title: 'Your pre-registration is still being reviewed',
          description: `Please wait while we review your pre-registration. We'll send you an email when it's approved.`
        };
      }

      return {};
    };

    switch (preRegistration.acceptanceStatus) {
      case 'ACCEPTED':
        reset(mapPreRegistrationToFormValues(preRegistration));
        return true;
      default:
        errorToast(getTitleAndDescription(preRegistration.acceptanceStatus));
        return false;
    }
  };

  const getAndSetPreRegistration = async () => {
    const email = getValues('email');

    try {
      const response = await api.execute(checkPreRegistration(eventId, email));
      switch (response.status) {
        case 200:
          return {
            isSuccess: checkAcceptanceStatus(response.data),
            preregistrationData: response.data
          };

        case 404:
          errorToast({
            title: 'Email not found',
            description: 'The email you entered was not found. Please enter a different email.'
          });
          return {
            isSuccess: false
          };

        default:
          errorToast({
            title: 'Please try again',
            description: 'There was an error. Please try again.'
          });
          return {
            isSuccess: false
          };
      }
    } catch (error) {
      errorToast({
        title: 'Please try again',
        description: 'There was an error. Please try again.'
      });
      return {
        isSuccess: false
      };
    }
  };

  // Function to set the total price
  const setPaymentTotal = () => {
    const total = Number(calculateTotalPrice(event.price, transactionFee ?? null, percentageDiscount ?? null, event.platformFee).toFixed(2));
    setValue('total', total);
  };

  const onNextStep = async () => {
    const moveToNextStep = () => {
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
        scrollToView();
      }
    };

    if (isEmpty(fieldsToCheck)) {
      moveToNextStep();
    } else {
      const isValid = await trigger(fieldsToCheck);
      if (isValid) {
        moveToNextStep();
        scrollToView();
      }
    }
  };

  const onPrevStep = () => {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const onStartRegister = async () => {
    if (event.isApprovalFlow && event.status === 'open') {
      const isValid = await trigger(fieldsToCheck);
      if (!isValid) {
        return;
      }

      const { isSuccess: hasPreRegistered, preregistrationData } = await getAndSetPreRegistration();
      const hasRegistered = await validateEmail();
      if (!hasPreRegistered || !hasRegistered) {
        return;
      }

      if (!event.paidEvent) {
        setCurrentStep(STEP_SUCCESS);
        return;
      }

      // TODO: registration to form values
      preregistrationData && setRegistrationValues(preregistrationData, setValue);
      setCurrentStep(STEP_PAYMENT);
      return;
    }

    onNextStep();
  };

  const setRegistrationValues = (preregistrationData: PreRegistration, setValue: UseFormSetValue<RegisterFormValues>) => {
    Object.keys(preregistrationData).forEach((key) => {
      if (Object.keys(getValues()).includes(key)) {
        const value = preregistrationData[key as keyof PreRegistration];
        if (typeof value === 'string' || typeof value === 'number' || value === null || value === undefined) {
          setValue(key as keyof RegisterFormValues, value);
        }
      }
    });
  };

  const onCheckEmailNextStep = async () => {
    if (event.isApprovalFlow && event.status === 'open') {
      onNextStep();
      return;
    }

    const isValid = await validateEmail();
    if (isValid) {
      onNextStep();
    }
  };

  const onSummaryStep = () => {
    if (!transactionFee) {
      return;
    }

    setPaymentTotal();
    onNextStep();
  };

  const saveFormState = () => {
    const formState = getValues();
    localStorage.setItem('formState', JSON.stringify(formState));
  };

  const onRequestPayment = async () => {
    const { paymentMethod, paymentChannel, total } = getValues();
    if (!paymentMethod || !paymentChannel || !total) {
      return;
    }

    saveFormState();

    if (paymentMethod === 'E_WALLET') {
      await eWalletRequest(total, paymentChannel);
    } else if (paymentMethod === 'DIRECT_DEBIT') {
      await directDebitRequest(total, paymentChannel);
    }
  };

  const onSubmitForm = async () => {
    const total = getValues('total');

    if (event.isApprovalFlow && event.status === 'preregistration') {
      setCurrentStep(STEP_SUCCESS);
    }

    if (!event.paidEvent || total === 0) {
      setCurrentStep(STEP_SUCCESS);
    }

    if (event.maximumSlots) {
      const isEventFull = await checkRegistrationCount();

      if (isEventFull) {
        reloadPage();
        return;
      }
    }

    if (event.isApprovalFlow && event.status === 'open') {
      setPaymentTotal();
    }

    try {
      setIsFormSubmitting(true);
      await onRequestPayment();
    } catch (error) {
      console.error(error);
    } finally {
      setIsFormSubmitting(false);
    }
  };

  return {
    paymentButtonDisabled,
    isValidatingEmail,
    isFormSubmitting,
    onNextStep,
    onPrevStep,
    onStartRegister,
    onCheckEmailNextStep,
    onSummaryStep,
    onSignUpOther: reloadPage,
    onSubmitForm
  };
};
