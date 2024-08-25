import os
from datetime import datetime
from typing import Optional

from model.events.events_constants import EventStatus, RegistrationType
from pydantic import BaseModel, EmailStr, Extra, Field
from pynamodb.attributes import BooleanAttribute, NumberAttribute, UnicodeAttribute
from pynamodb.indexes import AllProjection, LocalSecondaryIndex
from pynamodb.models import Model


class EventIdIndex(LocalSecondaryIndex):
    class Meta:
        index_name = 'eventId-index'
        projection = AllProjection()
        read_capacity_units = 1
        write_capacity_units = 1

    hashKey = UnicodeAttribute(hash_key=True)
    eventId = UnicodeAttribute(range_key=True)


class Event(Model):
    # hk: v<version_number>
    # rk: <adminId>#<eventId>
    class Meta:
        table_name = os.getenv('EVENTS_TABLE')
        region = os.getenv('REGION')
        billing_mode = 'PAY_PER_REQUEST'

    hashKey = UnicodeAttribute(hash_key=True)
    rangeKey = UnicodeAttribute(range_key=True)

    latestVersion = NumberAttribute(null=False)
    entryStatus = UnicodeAttribute(null=False)
    eventId = UnicodeAttribute(null=False)

    createDate = UnicodeAttribute(null=True)
    updateDate = UnicodeAttribute(null=True)
    createdBy = UnicodeAttribute(null=True)
    updatedBy = UnicodeAttribute(null=True)

    name = UnicodeAttribute(null=True)
    description = UnicodeAttribute(null=True)
    status = UnicodeAttribute(null=True)
    registrationType = UnicodeAttribute(null=True)
    redirectRegisterUrl = UnicodeAttribute(null=True)
    email = UnicodeAttribute(null=True)
    startDate = UnicodeAttribute(null=True)
    endDate = UnicodeAttribute(null=True)
    venue = UnicodeAttribute(null=True)
    bannerLink = UnicodeAttribute(null=True)
    logoLink = UnicodeAttribute(null=True)
    paidEvent = BooleanAttribute(null=True)
    price = NumberAttribute(null=True)
    certificateTemplate = UnicodeAttribute(null=True)
    isApprovalFlow = BooleanAttribute(null=True)

    gcashQRCode = UnicodeAttribute(null=True)
    gcashName = UnicodeAttribute(null=True)
    gcashNumber = UnicodeAttribute(null=True)

    isLimitedSlot = BooleanAttribute(default=False)
    registrationCount = NumberAttribute(default=0)
    maximumSlots = NumberAttribute(null=True)

    dailyEmailCount = NumberAttribute(default=0)
    lastEmailSent = UnicodeAttribute(null=True)

    eventIdIndex = EventIdIndex()


class EventIn(BaseModel):
    class Config:
        extra = Extra.forbid

    name: str = Field(None, title='Name')
    description: str = Field(None, title='Description')
    registrationType: RegistrationType = Field(RegistrationType.TECHTIX, title='Registration Type')
    redirectRegisterUrl: str = Field(None, title='Redirect Register URL')
    email: EmailStr = Field(None, title='Email')
    startDate: datetime = Field(None, title='Date')
    endDate: datetime = Field(None, title='Date')
    venue: str = Field(None, title='Venue')
    paidEvent: bool = Field(None, title='Paid Event')
    price: float = Field(None, title='Price')
    bannerLink: str = Field(None, title='Banner Link')
    logoLink: str = Field(None, title='Poster Link')
    certificateTemplate: str = Field(None, title='Certificate Template')
    isApprovalFlow: bool = Field(None, title='Approval Flow')

    isLimitedSlot: bool = Field(None, title='Is Limited Slot')
    maximumSlots: int = Field(None, title='Maximum Slots')

    status: Optional[EventStatus] = Field(None, title='Event Status')


class EventDataIn(EventIn):
    class Config:
        extra = Extra.forbid

    gcashQRCode: str = Field(None, title='GCash QR Code')
    gcashName: str = Field(None, title='Gcash Name')
    gcashNumber: str = Field(None, title='Gcash Number')

    registrationCount: int = Field(None, title='Registration Count')

    dailyEmailCount: int = Field(None, title='Daily Email Count')
    lastEmailSent: datetime = Field(None, title='Last Email Sent')


class EventOut(EventDataIn):
    class Config:
        extra = Extra.ignore

    eventId: str = Field(..., title='ID')
    createDate: datetime = Field(..., title='Created At')
    updateDate: datetime = Field(..., title='Updated At')
    createdBy: str = Field(..., title='Created By')
    updatedBy: str = Field(None, title='Updated By')
    bannerUrl: Optional[str] = Field(None, title='Banner Pre-signed URL')
    logoUrl: Optional[str] = Field(None, title='Logo Pre-signed URL')
    certificateTemplateUrl: Optional[str] = Field(None, title='Certificate Template Pre-signed URL')
