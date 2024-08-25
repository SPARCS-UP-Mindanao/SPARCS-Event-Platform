import json
from http import HTTPStatus
from typing import List, Union

import ulid
from model.events.event import Event
from model.events.events_constants import EventStatus, RegistrationType
from model.registrations.registration import (
    PreRegistrationToRegistrationIn,
    RegistrationIn,
    RegistrationOut,
    RegistrationPatch,
)
from repository.events_repository import EventsRepository
from repository.registrations_repository import RegistrationsRepository
from starlette.responses import JSONResponse
from usecase.discount_usecase import DiscountUsecase
from usecase.email_usecase import EmailUsecase
from usecase.event_usecase import EventUsecase
from usecase.file_s3_usecase import FileS3Usecase
from usecase.preregistration_usecase import PreRegistrationUsecase


class RegistrationUsecase:
    """
    Handles the business logic for managing registration entries.

    This class provides methods for creating, updating, retrieving, listing, and deleting registration entries.

    Attributes:
        registrations_repository (RegistrationsRepository): An instance of the RegistrationsRepository used for data access.
    """

    def __init__(self):
        self.__registrations_repository = RegistrationsRepository()
        self.__events_repository = EventsRepository()
        self.__email_usecase = EmailUsecase()
        self.__discount_usecase = DiscountUsecase()
        self.__file_s3_usecase = FileS3Usecase()
        self.__preregistration_usecase = PreRegistrationUsecase()

    def create_registration(self, registration_in: RegistrationIn) -> Union[JSONResponse, RegistrationOut]:
        """Creates a new registration entry.

        :param registration_in: The data for creating the new registration.
        :type registration_in: RegistrationIn

        :return: If successful, returns the created registration entry. If unsuccessful, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, RegistrationOut]

        """

        event = EventsRepository.query_events(registration_in.eventId)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Registrations should not be created for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, event, message = self.__events_repository.query_events(event_id=registration_in.eventId)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        if event.isApprovalFlow:
            return self.create_registration_approval_flow(event=event, registration_in=registration_in)

        # Check if the event is still open
        if event.paidEvent and event.status != EventStatus.OPEN.value:
            return JSONResponse(
                status_code=HTTPStatus.BAD_REQUEST,
                content={'message': 'Event is not open for registration'},
            )

        # Check if the registration with the same email already exists
        event_id = registration_in.eventId
        email = registration_in.email
        (
            status,
            registrations,
            message,
        ) = self.__registrations_repository.query_registrations_with_email(event_id=event_id, email=email)
        if status == HTTPStatus.OK and registrations:
            return JSONResponse(
                status_code=HTTPStatus.CONFLICT,
                content={'message': f'Registration with email {email} already exists'},
            )

        # check if registration count in event is full
        future_registrations = event.registrationCount
        if event.isLimitedSlot and future_registrations >= event.maximumSlots:
            return JSONResponse(
                status_code=HTTPStatus.BAD_REQUEST,
                content={'message': f'Event registration is full. Maximum slots: {event.maximumSlots}'},
            )

        registration_id = ulid.ulid()
        discount_code = registration_in.discountCode
        if discount_code:
            claimed_discount = self.__discount_usecase.claim_discount(
                entry_id=discount_code,
                registration_id=registration_id,
                event_id=event_id,
            )
            if isinstance(claimed_discount, JSONResponse):
                return claimed_discount

        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.store_registration(
            registration_in=registration_in, registration_id=registration_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, __, message = self.__events_repository.append_event_registration_count(event_entry=event)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        registration_data = self.__convert_data_entry_to_dict(registration)

        if not registration.registrationEmailSent:
            self.__email_usecase.send_registration_creation_email(registration=registration, event=event)

        registration_out = RegistrationOut(**registration_data)
        return self.collect_pre_signed_url(registration_out)

    def create_registration_approval_flow(
        self, event: Event, registration_in: RegistrationIn
    ) -> Union[JSONResponse, RegistrationOut]:
        """Creates a new registration entry for an event with approval flow.

        :param event: The event for which the registration is being created.
        :type event: Event

        :param registration_in: The data for creating the new registration.
        :type registration_in: RegistrationIn

        :return: If successful, returns the created registration entry. If unsuccessful, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, RegistrationOut]

        """
        event_id = registration_in.eventId
        email = registration_in.email
        preregistration = self.__preregistration_usecase.get_preregistration_by_email(event_id=event_id, email=email)

        if isinstance(preregistration, JSONResponse):
            return preregistration

        registration_data = preregistration.dict()
        registration_data_in = PreRegistrationToRegistrationIn(
            **registration_data,
            discountCode=registration_in.discountCode,
            referenceNumber=registration_in.referenceNumber,
            amountPaid=registration_in.amountPaid,
        )

        registration_id = preregistration.preRegistrationId
        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.store_registration(
            registration_in=registration_data_in,
            registration_id=registration_id,
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, __, message = self.__events_repository.append_event_registration_count(event_entry=event)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        registration_data = self.__convert_data_entry_to_dict(registration)

        if not registration.registrationEmailSent:
            self.__email_usecase.send_registration_creation_email(registration=registration, event=event)

        registration_out = RegistrationOut(**registration_data)
        return self.collect_pre_signed_url(registration_out)

    def update_registration(
        self, event_id: str, registration_id: str, registration_in: RegistrationPatch
    ) -> Union[JSONResponse, RegistrationOut]:
        """Updates an existing registration entry.

        :param registration_id: The unique identifier of the registration to be updated.
        :type registration_id: str

        :param registration_in: The data for updating the registration.
        :type registration_in: RegistrationIn

        :return: If successful, returns the updated registration entry. If unsuccessful, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, RegistrationOut]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'No registrations for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.query_registration_with_registration_id(
            event_id=event_id, registration_id=registration_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            update_registration,
            message,
        ) = self.__registrations_repository.update_registration(
            registration_entry=registration, registration_in=registration_in
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        registration_data = self.__convert_data_entry_to_dict(update_registration)
        registration_out = RegistrationOut(**registration_data)
        return self.collect_pre_signed_url(registration_out)

    def get_registration(self, event_id: str, registration_id: str) -> Union[JSONResponse, RegistrationOut]:
        """Retrieves a specific registration entry by its ID.

        :param event_id: The ID of the event
        :type event_id: str

        :param registration_id: The unique identifier of the registration to be retrieved.
        :type registration_id: str

        :return: If found, returns the requested registration entry. If not found, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, RegistrationOut]

        """

        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'No registrations for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.query_registration_with_registration_id(
            event_id=event_id, registration_id=registration_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        registration_data = self.__convert_data_entry_to_dict(registration)
        registration_out = RegistrationOut(**registration_data)
        return self.collect_pre_signed_url(registration_out)

    def get_registration_by_email(self, event_id: str, email: str) -> RegistrationOut:
        """Retrieves a specific registration entry by its email.

        :param event_id: The ID of the event
        :type event_id: str

        :param email: The email of the registration to be retrieved.
        :type email: str

        :return: If found, returns the requested registration entry. If not found, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, RegistrationOut]

        """
        (
            status,
            registrations,
            message,
        ) = self.__registrations_repository.query_registrations_with_email(event_id=event_id, email=email)
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'No registrations for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        if status != HTTPStatus.OK or not registrations:
            return JSONResponse(status_code=status, content={'message': message})

        registration = registrations[0]
        registration_data = self.__convert_data_entry_to_dict(registration)
        registration_out = RegistrationOut(**registration_data)

        return self.collect_pre_signed_url(registration_out)

    def get_registrations(self, event_id: str = None) -> Union[JSONResponse, List[RegistrationOut]]:
        """Retrieves a list of registration eregistration_idntries.

        :param event_id: If provided, only retrieves registration entries for the specified event. If not provided, retrieves all registration entries.
        :type event_id: str, optional

        :return: If successful, returns a list of registration entries. If unsuccessful, returns a JSONResponse with an error message.
        :rtype: Union[JSONResponse, List[RegistrationOut]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'No registrations for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            registrations,
            message,
        ) = self.__registrations_repository.query_registrations(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        return [
            self.collect_pre_signed_url(RegistrationOut(**self.__convert_data_entry_to_dict(registration)))
            for registration in registrations
        ]

    def delete_registration(self, event_id: str, registration_id: str) -> Union[None, JSONResponse]:
        """Deletes a specific registration entry by its ID.

        :param event_id: The ID of the event
        :type event_id: str

        :param registration_id: The unique identifier of the registration to be deleted.
        :type registration_id: str

        :return: If deleted successfully, returns None. If unsuccessful, returns a JSONResponse with an error message.
        :rtype: Union[None, JSONResponse]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'No registrations for REDIRECT registration type'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.query_registration_with_registration_id(
            event_id=event_id, registration_id=registration_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, message = self.__registrations_repository.delete_registration(registration_entry=registration)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        return None

    def collect_pre_signed_url(self, registration: RegistrationOut):
        """Collects the pre-signed URL for the GCash payment image.

        :param registration: The registration entry to be updated.
        :type registration: RegistrationOut

        :return: The updated registration entry with the pre-signed URL for the GCash payment image.
        :rtype: RegistrationOut

        """
        if registration.gcashPayment:
            gcash_payment = self.__file_s3_usecase.create_download_url(registration.gcashPayment)
            registration.gcashPaymentUrl = gcash_payment.downloadLink

        return registration

    @staticmethod
    def __convert_data_entry_to_dict(data_entry):
        """Converts a data entry to a dictionary.

        :param data_entry: The data entry to be converted.
        :type data_entry: Any

        :return: A dictionary representation of the data entry.
        :rtype: dict

        """

        return json.loads(data_entry.to_json())
