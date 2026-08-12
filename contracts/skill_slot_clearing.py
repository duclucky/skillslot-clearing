# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

from dataclasses import dataclass


MAX_ID_LENGTH = 80
MAX_TITLE_LENGTH = 120
UNIT_GEN = 10**18

PHASE_OPEN = "OPEN"


@allow_storage
@dataclass
class Round:
    round_id: str
    creator: Address
    title: str
    phase: str
    booking_fee_wei: bigint
    provider_bond_wei: bigint
    offer_ids_csv: str
    request_ids_csv: str
    offer_count: u256
    request_count: u256
    attempt_count: u256
    match_count: u256
    locked_liability_wei: bigint


@allow_storage
@dataclass
class Offer:
    round_id: str
    offer_id: str
    provider: Address
    label: str
    promise_text: str
    capability_ids_csv: str
    deposit_wei: bigint
    matched_request_id: str
    active: bool


@allow_storage
@dataclass
class Request:
    round_id: str
    request_id: str
    requester: Address
    label: str
    need_text: str
    required_ids_csv: str
    excluded_ids_csv: str
    deposit_wei: bigint
    matched_offer_id: str
    outcome: str


@allow_storage
@dataclass
class Match:
    round_id: str
    offer_id: str
    request_id: str
    provider: Address
    requester: Address
    grant_status: str


def _addr_str(address: Address) -> str:
    try:
        return address.as_hex
    except Exception:
        return str(address)


def _is_valid_id(value: str) -> bool:
    if len(value) < 3 or len(value) > MAX_ID_LENGTH:
        return False
    first = value[0]
    if not (
        (first >= "a" and first <= "z")
        or (first >= "A" and first <= "Z")
        or (first >= "0" and first <= "9")
    ):
        return False
    for char in value:
        if not (
            (char >= "a" and char <= "z")
            or (char >= "A" and char <= "Z")
            or (char >= "0" and char <= "9")
            or char == "-"
            or char == "_"
            or char == "."
        ):
            return False
    return True


def _has_control_character(value: str) -> bool:
    for char in value:
        if ord(char) < 32 or ord(char) == 127:
            return True
    return False


def _validate_title(value: str) -> str:
    normalized = value.strip()
    if len(normalized) < 3 or len(normalized) > MAX_TITLE_LENGTH or _has_control_character(normalized):
        raise gl.vm.UserError("Round title is invalid")
    return normalized


def _round_view(round_record: Round) -> dict:
    return {
        "round_id": round_record.round_id,
        "creator": _addr_str(round_record.creator),
        "title": round_record.title,
        "phase": round_record.phase,
        "booking_fee_wei": str(round_record.booking_fee_wei),
        "provider_bond_wei": str(round_record.provider_bond_wei),
        "offer_ids_csv": round_record.offer_ids_csv,
        "request_ids_csv": round_record.request_ids_csv,
        "offer_count": str(round_record.offer_count),
        "request_count": str(round_record.request_count),
        "attempt_count": str(round_record.attempt_count),
        "match_count": str(round_record.match_count),
        "locked_liability_wei": str(round_record.locked_liability_wei),
    }


class Contract(gl.Contract):
    rounds: TreeMap[str, Round]
    offers: TreeMap[str, Offer]
    requests: TreeMap[str, Request]
    matches: TreeMap[str, Match]
    offer_by_actor: TreeMap[str, str]
    request_by_actor: TreeMap[str, str]
    credits: TreeMap[str, bigint]
    round_ids: DynArray[str]
    total_received_wei: bigint
    total_locked_wei: bigint
    total_credited_wei: bigint
    total_withdrawn_wei: bigint

    def __init__(self) -> None:
        self.total_received_wei = bigint(0)
        self.total_locked_wei = bigint(0)
        self.total_credited_wei = bigint(0)
        self.total_withdrawn_wei = bigint(0)

    @gl.public.write
    def open_round(
        self,
        round_id: str,
        title: str,
        booking_fee_wei: int,
        provider_bond_wei: int,
    ) -> None:
        if not _is_valid_id(round_id):
            raise gl.vm.UserError("Round ID is invalid")
        if round_id in self.rounds:
            raise gl.vm.UserError("Round already exists")
        normalized_title = _validate_title(title)
        if int(booking_fee_wei) != UNIT_GEN:
            raise gl.vm.UserError("Booking fee must be exactly 1 GEN")
        if int(provider_bond_wei) != UNIT_GEN:
            raise gl.vm.UserError("Provider bond must be exactly 1 GEN")

        self.rounds[round_id] = Round(
            round_id=round_id,
            creator=gl.message.sender_address,
            title=normalized_title,
            phase=PHASE_OPEN,
            booking_fee_wei=bigint(booking_fee_wei),
            provider_bond_wei=bigint(provider_bond_wei),
            offer_ids_csv="",
            request_ids_csv="",
            offer_count=u256(0),
            request_count=u256(0),
            attempt_count=u256(0),
            match_count=u256(0),
            locked_liability_wei=bigint(0),
        )
        self.round_ids.append(round_id)

    @gl.public.view
    def get_round(self, round_id: str) -> dict:
        if round_id not in self.rounds:
            return {}
        return _round_view(self.rounds[round_id])

    @gl.public.view
    def get_round_ids(self) -> list[str]:
        result = []
        for round_id in self.round_ids:
            result.append(round_id)
        return result

    @gl.public.view
    def get_accounting(self) -> dict:
        received = int(self.total_received_wei)
        locked = int(self.total_locked_wei)
        credited = int(self.total_credited_wei)
        withdrawn = int(self.total_withdrawn_wei)
        return {
            "total_received_wei": str(received),
            "total_locked_wei": str(locked),
            "total_credited_wei": str(credited),
            "total_withdrawn_wei": str(withdrawn),
            "invariant_holds": received == locked + credited + withdrawn,
        }
