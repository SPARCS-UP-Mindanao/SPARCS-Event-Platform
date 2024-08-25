import json
import random
import string
from http import HTTPStatus
from typing import List, Union

from model.discount.discount import (
    DiscountDBIn,
    DiscountIn,
    DiscountOrganization,
    DiscountOut,
)
from model.events.events_constants import RegistrationType
from repository.discount_repository import DiscountsRepository
from repository.events_repository import EventsRepository
from repository.registrations_repository import RegistrationsRepository
from starlette.responses import JSONResponse
from usecase.event_usecase import EventUsecase
from utils.utils import Utils


class DiscountUsecase:
    def __init__(self):
        self.__discounts_repository = DiscountsRepository()
        self.__events_repository = EventsRepository()
        self.__registrations_repository = RegistrationsRepository()

    def get_discount(self, event_id: str, entry_id: str) -> DiscountOut:
        """Get a discount.

        :param event_id: The event ID.
        :type event_id: str

        :param entry_id: The entry ID.
        :type entry_id: str

        :return: DiscountOut object.
        :rtype: DiscountOut

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: No discounts for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, discount, message = self.__discounts_repository.query_discount_with_discount_id(
            event_id=event_id, discount_id=entry_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        discount_data = self.__convert_data_entry_to_dict(discount)
        discount_out = DiscountOut(**discount_data)

        if discount.registrationId:
            (
                _,
                registration_entry,
                _,
            ) = self.__registrations_repository.query_registration_with_registration_id(
                event_id=event_id, registration_id=discount.registrationId
            )
            if not registration_entry:
                return discount_out

            registration_data = self.__convert_data_entry_to_dict(registration_entry)
            discount_out.registration = registration_data

        return discount_out

    def get_discount_list(self, event_id: str) -> List[DiscountOrganization]:
        """Get a list of discounts.

        :param event_id: The event ID.
        :type event_id: str

        :return: List of DiscountOrganization objects.
        :rtype: List[DiscountOrganization]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: No discounts for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, discounts, message = self.__discounts_repository.query_discounts(
            event_id=event_id,
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        discount_map = {}
        for discount in discounts:
            discount_data = self.__convert_data_entry_to_dict(discount)
            discount_out = DiscountOut(**discount_data)

            if discount.registrationId:
                (
                    _,
                    registration_entry,
                    _,
                ) = self.__registrations_repository.query_registration_with_registration_id(
                    event_id=event_id, registration_id=discount.registrationId
                )
                if registration_entry:
                    registration_data = self.__convert_data_entry_to_dict(registration_entry)
                    discount_out.registration = registration_data

            discount_out_list = discount_map.get(discount_out.organizationId) or []
            discount_out_list.append(discount_out)
            discount_map[discount_out.organizationId] = discount_out_list

        return [
            DiscountOrganization(
                organizationId=organization_id,
                discounts=discount_out_list,
            )
            for organization_id, discount_out_list in discount_map.items()
        ]

    def claim_discount(self, event_id: str, entry_id: str, registration_id: str):
        """Claim a discount.

        :param event_id: The event ID.
        :type event_id: str

        :param entry_id: The entry ID.
        :type entry_id: str

        :param registration_id: The registration ID.
        :type registration_id: str

        :return: DiscountOut object or JSONResponse in case of error.
        :rtype: Union[DiscountOut, JSONResponse]

        """

        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: No discounts for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, discount_entry, message = self.__discounts_repository.query_discount_with_discount_id(
            discount_id=entry_id, event_id=event_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(
                status_code=HTTPStatus.BAD_REQUEST,
                content={'message': 'Discount Does Not Exist'},
            )

        if discount_entry.claimed:
            return JSONResponse(
                status_code=HTTPStatus.BAD_REQUEST,
                content={'message': 'Discount already claimed'},
            )

        discount_data = self.__convert_data_entry_to_dict(discount_entry)
        discount_data.update(claimed=True)
        discount_data.update(registrationId=registration_id)

        discount_in = DiscountDBIn(
            **discount_data,
        )
        status, discount, message = self.__discounts_repository.update_discount(
            discount_entry=discount_entry, discount_in=discount_in
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        discount_data = self.__convert_data_entry_to_dict(discount)
        return DiscountOut(**discount_data)

    def create_discounts(self, discount_in: DiscountIn) -> Union[JSONResponse, List[DiscountOut]]:
        """Create discounts.

        :param discount_in: DiscountIn object containing the new discount data.
        :type discount_in: DiscountIn

        :return: List of DiscountOut objects or JSONResponse in case of error.
        :rtype: Union[JSONResponse, List[DiscountOut]]

        """
        event = EventUsecase.get_event(DiscountIn.eventId)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: Discounts should not be created for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, _, __ = self.__events_repository.query_events(discount_in.eventId)

        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': 'Event does not exist'})

        discount_list = []
        organization_id = Utils.convert_to_slug(discount_in.organizationName)
        for _ in range(discount_in.quantity):
            discount_in = DiscountDBIn(
                organizationId=organization_id,
                eventId=discount_in.eventId,
                claimed=False,
                registrationId=None,
                discountPercentage=discount_in.discountPercentage,
                entryId=self.__generate_discount_code(),
            )

            status, discount, message = self.__discounts_repository.store_discount(discount_in=discount_in)
            if status != HTTPStatus.OK:
                return JSONResponse(status_code=status, content={'message': message})

            discount_data = self.__convert_data_entry_to_dict(discount)
            discount_out = DiscountOut(**discount_data)
            discount_list.append(discount_out)

        return discount_list

    def __generate_discount_code(self, length=8):
        """Generate a discount code.

        :param length: The length of the discount code (default is 8).
        :type length: int

        :return: The generated discount code.
        :rtype: str

        """
        characters = string.ascii_uppercase + string.digits
        return ''.join(random.choice(characters) for _ in range(length))

    @staticmethod
    def __convert_data_entry_to_dict(data_entry):
        """Convert a data entry to a dictionary.

        :param data_entry: The data entry to be converted.
        :type data_entry: Any

        :return: The converted data entry.
        :rtype: dict
        """
        return json.loads(data_entry.to_json())
