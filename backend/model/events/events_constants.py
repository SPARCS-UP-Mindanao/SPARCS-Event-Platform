from enum import Enum


class EventStatus(str, Enum):
    DRAFT = 'draft'
    PRE_REGISTRATION = 'preregistration'
    OPEN = 'open'
    CANCELLED = 'cancelled'
    CLOSED = 'closed'
    COMPLETED = 'completed'


class EventUploadType(str, Enum):
    BANNER = 'banner'
    LOGO = 'logo'
    CERTIFICATE_TEMPLATE = 'certificateTemplate'
    PAYMENT_PROOF = 'proofOfPayment'
    GCASH_QR = 'gcashQRCode'


class EventUploadField(str, Enum):
    BANNER = 'bannerLink'
    LOGO = 'logoLink'
    CERTIFICATE_TEMPLATE = 'certificateTemplate'


class RegistrationType(str, Enum):
    TECHTIX = 'TechTix'
    REDIRECT = 'redirect'
