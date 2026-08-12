# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

from dataclasses import dataclass


MAX_ID_LENGTH = 80
MAX_TITLE_LENGTH = 120
MAX_LABEL_LENGTH = 120
MAX_TEXT_LENGTH = 600
MAX_CSV_LENGTH = 600
MAX_POSITIONS = 4
UNIT_GEN = 10**18

PHASE_OPEN = "OPEN"
PHASE_LOCKED = "LOCKED"
OUTCOME_PENDING = "PENDING"


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


def _addr_key(address: Address) -> str:
    return _addr_str(address).lower()


def _is_same_address(left: Address, right: Address) -> bool:
    return _addr_key(left) == _addr_key(right)


def _position_key(round_id: str, position_id: str) -> str:
    return round_id + "|" + position_id


def _actor_key(round_id: str, role: str, actor: Address) -> str:
    return round_id + "|" + role + "|" + _addr_key(actor)


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


def _validate_bounded_text(value: str, label: str, max_length: int, min_length: int = 1) -> str:
    normalized = value.strip()
    if (
        len(normalized) < min_length
        or len(normalized) > max_length
        or _has_control_character(normalized)
    ):
        raise gl.vm.UserError(label + " is invalid")
    return normalized


def _normalize_csv(value: str, label: str) -> str:
    if len(value) > MAX_CSV_LENGTH:
        raise gl.vm.UserError(label + " are invalid")
    if len(value.strip()) == 0:
        return ""
    normalized_items = []
    for raw_item in value.split(","):
        item = raw_item.strip()
        if not _is_valid_id(item) or item in normalized_items:
            raise gl.vm.UserError(label + " are invalid")
        normalized_items.append(item)
    return ",".join(normalized_items)


def _append_csv(existing: str, item: str) -> str:
    if len(existing) == 0:
        return item
    return existing + "," + item


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


def _offer_view(offer: Offer) -> dict:
    return {
        "round_id": offer.round_id,
        "offer_id": offer.offer_id,
        "provider": _addr_str(offer.provider),
        "label": offer.label,
        "promise_text": offer.promise_text,
        "capability_ids_csv": offer.capability_ids_csv,
        "deposit_wei": str(offer.deposit_wei),
        "matched_request_id": offer.matched_request_id,
        "active": offer.active,
    }


def _request_view(request: Request) -> dict:
    return {
        "round_id": request.round_id,
        "request_id": request.request_id,
        "requester": _addr_str(request.requester),
        "label": request.label,
        "need_text": request.need_text,
        "required_ids_csv": request.required_ids_csv,
        "excluded_ids_csv": request.excluded_ids_csv,
        "deposit_wei": str(request.deposit_wei),
        "matched_offer_id": request.matched_offer_id,
        "outcome": request.outcome,
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

    @gl.public.write.payable
    def submit_offer(
        self,
        round_id: str,
        offer_id: str,
        label: str,
        promise_text: str,
        capability_ids_csv: str,
    ) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round does not exist")
        round_record = self.rounds[round_id]
        if round_record.phase != PHASE_OPEN:
            raise gl.vm.UserError("Round is not open")
        if int(gl.message.value) != int(round_record.provider_bond_wei):
            raise gl.vm.UserError("Provider bond must be exactly 1 GEN")
        if not _is_valid_id(offer_id):
            raise gl.vm.UserError("Offer ID is invalid")
        offer_key = _position_key(round_id, offer_id)
        if offer_key in self.offers:
            raise gl.vm.UserError("Offer already exists")
        sender = gl.message.sender_address
        actor_key = _actor_key(round_id, "offer-actor", sender)
        if actor_key in self.offer_by_actor:
            raise gl.vm.UserError("Wallet already submitted an offer")
        if int(round_record.offer_count) >= MAX_POSITIONS:
            raise gl.vm.UserError("Offer limit reached")

        normalized_label = _validate_bounded_text(label, "Offer label", MAX_LABEL_LENGTH, 3)
        normalized_promise = _validate_bounded_text(promise_text, "Promise text", MAX_TEXT_LENGTH)
        normalized_capabilities = _normalize_csv(capability_ids_csv, "Capability IDs")
        deposit = int(gl.message.value)
        self.offers[offer_key] = Offer(
            round_id=round_id,
            offer_id=offer_id,
            provider=sender,
            label=normalized_label,
            promise_text=normalized_promise,
            capability_ids_csv=normalized_capabilities,
            deposit_wei=bigint(deposit),
            matched_request_id="",
            active=True,
        )
        self.offer_by_actor[actor_key] = offer_id
        round_record.offer_ids_csv = _append_csv(round_record.offer_ids_csv, offer_id)
        round_record.offer_count = u256(int(round_record.offer_count) + 1)
        round_record.locked_liability_wei = bigint(int(round_record.locked_liability_wei) + deposit)
        self.total_received_wei = bigint(int(self.total_received_wei) + deposit)
        self.total_locked_wei = bigint(int(self.total_locked_wei) + deposit)

    @gl.public.write.payable
    def submit_request(
        self,
        round_id: str,
        request_id: str,
        label: str,
        need_text: str,
        required_ids_csv: str,
        excluded_ids_csv: str,
    ) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round does not exist")
        round_record = self.rounds[round_id]
        if round_record.phase != PHASE_OPEN:
            raise gl.vm.UserError("Round is not open")
        if int(gl.message.value) != int(round_record.booking_fee_wei):
            raise gl.vm.UserError("Booking fee must be exactly 1 GEN")
        if not _is_valid_id(request_id):
            raise gl.vm.UserError("Request ID is invalid")
        request_key = _position_key(round_id, request_id)
        if request_key in self.requests:
            raise gl.vm.UserError("Request already exists")
        sender = gl.message.sender_address
        actor_key = _actor_key(round_id, "request-actor", sender)
        if actor_key in self.request_by_actor:
            raise gl.vm.UserError("Wallet already submitted a request")
        if int(round_record.request_count) >= MAX_POSITIONS:
            raise gl.vm.UserError("Request limit reached")

        normalized_label = _validate_bounded_text(label, "Request label", MAX_LABEL_LENGTH, 3)
        normalized_need = _validate_bounded_text(need_text, "Need text", MAX_TEXT_LENGTH)
        normalized_required = _normalize_csv(required_ids_csv, "Required IDs")
        normalized_excluded = _normalize_csv(excluded_ids_csv, "Excluded IDs")
        deposit = int(gl.message.value)
        self.requests[request_key] = Request(
            round_id=round_id,
            request_id=request_id,
            requester=sender,
            label=normalized_label,
            need_text=normalized_need,
            required_ids_csv=normalized_required,
            excluded_ids_csv=normalized_excluded,
            deposit_wei=bigint(deposit),
            matched_offer_id="",
            outcome=OUTCOME_PENDING,
        )
        self.request_by_actor[actor_key] = request_id
        round_record.request_ids_csv = _append_csv(round_record.request_ids_csv, request_id)
        round_record.request_count = u256(int(round_record.request_count) + 1)
        round_record.locked_liability_wei = bigint(int(round_record.locked_liability_wei) + deposit)
        self.total_received_wei = bigint(int(self.total_received_wei) + deposit)
        self.total_locked_wei = bigint(int(self.total_locked_wei) + deposit)

    @gl.public.write
    def lock_round(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round does not exist")
        round_record = self.rounds[round_id]
        if not _is_same_address(gl.message.sender_address, round_record.creator):
            raise gl.vm.UserError("Only round creator can lock")
        if round_record.phase != PHASE_OPEN:
            raise gl.vm.UserError("Round is not open")
        if int(round_record.offer_count) == 0 or int(round_record.request_count) == 0:
            raise gl.vm.UserError("Round needs at least one offer and request")
        round_record.phase = PHASE_LOCKED

    @gl.public.view
    def get_round(self, round_id: str) -> dict:
        if round_id not in self.rounds:
            return {}
        return _round_view(self.rounds[round_id])

    @gl.public.view
    def get_offer(self, round_id: str, offer_id: str) -> dict:
        key = _position_key(round_id, offer_id)
        if key not in self.offers:
            return {}
        return _offer_view(self.offers[key])

    @gl.public.view
    def get_request(self, round_id: str, request_id: str) -> dict:
        key = _position_key(round_id, request_id)
        if key not in self.requests:
            return {}
        return _request_view(self.requests[key])

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
