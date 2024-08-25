import json
from http import HTTPStatus
from typing import List, Union

from model.evaluations.evaluation import (
    EvaluationListIn,
    EvaluationListOut,
    EvaluationOut,
    EvaluationPatch,
)
from model.events.events_constants import RegistrationType
from model.registrations.registration import RegistrationPatch, RegistrationPreviewOut
from repository.evaluations_repository import EvaluationRepository
from repository.events_repository import EventsRepository
from repository.registrations_repository import RegistrationsRepository
from starlette.responses import JSONResponse
from usecase.event_usecase import EventUsecase


class EvaluationUsecase:
    def __init__(self):
        self.__evaluations_repository = EvaluationRepository()
        self.__registrations_repository = RegistrationsRepository()
        self.__events_repository = EventsRepository()

    def create_evaluation(self, evaluation_list_in: EvaluationListIn) -> Union[JSONResponse, List[EvaluationOut]]:
        """Create evaluations for a registration

        :param evaluation_list_in: The evaluations to be created
        :type evaluation_list_in: EvaluationListIn

        :return: The created evaluations
        :rtype: Union[JSONResponse, List[EvaluationOut]]

        """
        event_id = evaluation_list_in.eventId
        registration_id = evaluation_list_in.registrationId

        # NOTE: next three lines copy pasted a lot, should this be a helper or nah kay mubo ra
        event = EventsRepository.query_events(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: Evaluation should not be created for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.BAD_REQUEST, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            registration,
            message,
        ) = self.__registrations_repository.query_registrations(event_id=event_id, registration_id=registration_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            evaluation_list,
            message,
        ) = self.__evaluations_repository.store_evaluation(evaluation_list_in=evaluation_list_in)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        self.__registrations_repository.update_registration(
            registration_entry=registration,
            registration_in=RegistrationPatch(certificateClaimed=True),
        )

        return [EvaluationOut(**self.__convert_data_entry_to_dict(evaluation)) for evaluation in evaluation_list]

    def update_evaluation(
        self,
        event_id: str,
        registration_id: str,
        question: str,
        evaluation_in: EvaluationPatch,
    ) -> Union[JSONResponse, EvaluationOut]:
        """Update an evaluation

        :param event_id: The id of the event
        :type event_id: str

        :param registration_id: The id of the registration
        :type registration_id: str

        :param question: The question to be updated
        :type question: str

        :param evaluation_in: The evaluation to be updated
        :type evaluation_in: EvaluationPatch

        :return: The updated evaluation
        :rtype: Union[JSONResponse, EvaluationOut]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: No evaluation to update for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, __, message = self.__registrations_repository.query_registrations(
            event_id=event_id, registration_id=registration_id
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, evaluation, message = self.__evaluations_repository.query_evaluations(
            event_id, registration_id, question
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            update_evaluation,
            message,
        ) = self.__evaluations_repository.update_evaluation(evaluation_entry=evaluation, evaluation_in=evaluation_in)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        evaluation_data = self.__convert_data_entry_to_dict(update_evaluation)
        return EvaluationOut(**evaluation_data)

    def get_evaluation(self, event_id: str, registration_id: str, question: str) -> Union[JSONResponse, EvaluationOut]:
        """Get an evaluation

        :param event_id: The id of the event
        :type event_id: str

        :param registration_id: The id of the registration
        :type registration_id: str

        :param question: The question to be updated
        :type question: str

        :return: The evaluation for the registration
        :rtype: Union[JSONResponse, EvaluationOut]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            message = 'Error: No evaluations for REDIRECT registrationType'
            return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        status, evaluation, message = self.__evaluations_repository.query_evaluations(
            event_id, registration_id, question
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        evaluations_data = self.__convert_data_entry_to_dict(evaluation)
        return EvaluationOut(**evaluations_data)

    def get_evaluations(
        self, event_id: str = None, registration_id: str = None, question: str = None
    ) -> Union[JSONResponse, List[EvaluationListOut]]:
        """Get evaluations for a registration

        :param event_id: The id of the event. Defaults to None.
        :type event_id: str, optional

        :param registration_id: The id of the registration. Defaults to None.
        :type registration_id: str, optional

        :param question: The question to be updated. Defaults to None.
        :type question: str, optional

        :return: The evaluations for the registration
        :rtype: Union[JSONResponse, List[EvaluationListOut]]

        """
        if event_id:
            event = EventUsecase.get_event(event_id)
            if event.registrationType == RegistrationType.REDIRECT:
                message = 'Error: No evaluations for REDIRECT registrationType'
                return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={'message': message})

            status, _, message = self.__events_repository.query_events(event_id=event_id)
            if status != HTTPStatus.OK:
                return JSONResponse(status_code=status, content={'message': message})

        status, evaluations, message = self.__evaluations_repository.query_evaluations(
            event_id, registration_id, question
        )
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        evaluation_out_dict = {}
        for evaluation in evaluations:
            registration_id = evaluation.registrationId
            evealuation_dict = self.__convert_data_entry_to_dict(evaluation)
            evaluation_out = EvaluationOut(**evealuation_dict)

            evaluation_out_dict.setdefault(registration_id, []).append(evaluation_out)

        evaluations_return = []
        for registration_id, evaluation_out_list in evaluation_out_dict.items():
            evaluations_return_entry = EvaluationListOut(evaluationList=evaluation_out_list)

            _, registration, _ = self.__registrations_repository.query_registrations(
                event_id=event_id, registration_id=registration_id
            )
            if registration:
                registration_data = self.__convert_data_entry_to_dict(registration)
                registration_out = RegistrationPreviewOut(**registration_data)
                evaluations_return_entry.registration = registration_out

            evaluations_return.append(evaluations_return_entry)

        return evaluations_return

    def get_evaluations_by_question(self, event_id: str, question: str) -> Union[JSONResponse, List[EvaluationOut]]:
        """Get evaluations for a question

        :param event_id: The id of the event
        :type event_id: str

        :param question: The question to be updated
        :type question: str

        :return: The evaluations for the question
        :rtype: Union[JSONResponse, List[EvaluationOut]]

        """
        event = EventUsecase.get_event(event_id)
        if event.registrationType == RegistrationType.REDIRECT:
            return JSONResponse(
                status_code=HTTPStatus.NOT_FOUND,
                content={'message': 'Error: No evaluations for REDIRECT registrationType'},
            )

        status, _, message = self.__events_repository.query_events(event_id=event_id)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        (
            status,
            evaluations,
            message,
        ) = self.__evaluations_repository.query_evaluations_by_question(event_id, question)
        if status != HTTPStatus.OK:
            return JSONResponse(status_code=status, content={'message': message})

        evaluation_out_list = []
        for evaluation in evaluations:
            evaluation_dict = self.__convert_data_entry_to_dict(evaluation)
            evaluation_out = EvaluationOut(**evaluation_dict)
            evaluation_out_list.append(evaluation_out)

        return evaluation_out_list

    @staticmethod
    def __convert_data_entry_to_dict(data_entry):
        """Convert a data entry to a dictionary

        :param data_entry: The data entry to be converted
        :type data_entry: Any

        :return: The data entry as a dictionary
        :rtype: dict

        """
        return json.loads(data_entry.to_json())
