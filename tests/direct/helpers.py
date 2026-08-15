import json


CONTRACT_PATH = "contracts/skill_slot_clearing.py"
UNIT_GEN = 10**18
DEFAULT_OPEN_TIMEOUT_SECONDS = 3600
DEFAULT_CLEAR_TIMEOUT_SECONDS = 7200
DEFAULT_NOW = "2026-08-15T11:00:00Z"
DEFAULT_METADATA_EXPIRES_AT = 1_800_000_000
METADATA_ISSUER = "SkillSlotAgentRegistry"
METADATA_POLICY = "skillslot-agent-metadata-v1"
METADATA_PREFIX = "https://skillslot-clearing.vercel.app/agents/"


def open_round(contract, vm, creator, round_id="round-alpha", title="Agent access morning window"):
    set_time(vm)
    vm.sender = creator
    vm.value = 0
    contract.open_round(
        round_id,
        title,
        UNIT_GEN,
        UNIT_GEN,
        DEFAULT_OPEN_TIMEOUT_SECONDS,
        DEFAULT_CLEAR_TIMEOUT_SECONDS,
    )


def set_time(vm, iso_datetime=DEFAULT_NOW):
    import sys

    vm._datetime = iso_datetime
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and hasattr(gl, "message_raw") and gl.message_raw is not None:
        gl.message_raw["datetime"] = iso_datetime


def metadata_body(provider, agent_id="agent-alpha", capability_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK", expires_at=DEFAULT_METADATA_EXPIRES_AT):
    from tests.direct.conftest import to_hex

    return json.dumps(
        {
            "policy_version": METADATA_POLICY,
            "issuer": METADATA_ISSUER,
            "agent_id": agent_id,
            "provider": to_hex(provider),
            "capability_ids_csv": capability_ids_csv,
            "delivery_source": f"a2a://{agent_id}/route",
            "expires_at": expires_at,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def metadata_hash(body):
    import hashlib

    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def metadata_signature(body):
    return f"{METADATA_ISSUER}:v1:{metadata_hash(body)}"


def mock_agent_metadata(vm, provider, agent_id="agent-alpha", capability_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK", expires_at=DEFAULT_METADATA_EXPIRES_AT):
    body = metadata_body(provider, agent_id, capability_ids_csv, expires_at)
    vm.mock_web(
        METADATA_PREFIX + agent_id,
        {"method": "GET", "status": 200, "body": body},
    )
    return {
        "agent_id": agent_id,
        "metadata_uri": METADATA_PREFIX + agent_id,
        "metadata_hash": metadata_hash(body),
        "metadata_issuer": METADATA_ISSUER,
        "metadata_signature": metadata_signature(body),
        "metadata_expires_at": expires_at,
    }


def fund_contract(vm, value):
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + value)
    vm.value = 0


def submit_offer(
    contract,
    vm,
    provider,
    round_id="round-alpha",
    offer_id="offer-alpha",
    label="Calendar booking agent",
    promise_text="Books flights and calendar slots with confirmed availability.",
    capability_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK",
    value=UNIT_GEN,
    metadata=None,
):
    if metadata is None:
        metadata = mock_agent_metadata(vm, provider, agent_id=f"{round_id}-{offer_id}", capability_ids_csv=capability_ids_csv)
    vm.sender = provider
    vm.value = value
    contract.submit_offer(
        round_id,
        offer_id,
        label,
        promise_text,
        capability_ids_csv,
        metadata["agent_id"],
        metadata["metadata_uri"],
        metadata["metadata_hash"],
        metadata["metadata_issuer"],
        metadata["metadata_signature"],
        metadata["metadata_expires_at"],
    )
    fund_contract(vm, value)


def metadata_args(metadata):
    return (
        metadata["agent_id"],
        metadata["metadata_uri"],
        metadata["metadata_hash"],
        metadata["metadata_issuer"],
        metadata["metadata_signature"],
        metadata["metadata_expires_at"],
    )


def submit_request(
    contract,
    vm,
    requester,
    round_id="round-alpha",
    request_id="request-alpha",
    label="Flight scheduling need",
    need_text="Reserve a flight and place it on my calendar without hotel booking.",
    required_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK",
    excluded_ids_csv="HOTEL.BOOK",
    value=UNIT_GEN,
):
    vm.sender = requester
    vm.value = value
    contract.submit_request(
        round_id,
        request_id,
        label,
        need_text,
        required_ids_csv,
        excluded_ids_csv,
    )
    fund_contract(vm, value)


def lock_round(contract, vm, creator, round_id="round-alpha"):
    vm.sender = creator
    vm.value = 0
    contract.lock_round(round_id)


def mock_clearing(vm, result):
    vm.clear_mocks()
    vm.mock_llm(
        r"(?s).*SkillSlot Clearing semantic batch adjudicator.*",
        result if isinstance(result, str) else json.dumps(result),
    )


def pair_result(offer_id, request_id, decision, required_ids_csv="", prohibited_ids_csv=""):
    required = [item for item in required_ids_csv.split(",") if item]
    if decision == "MATCH":
        matched = ",".join(required)
        missing = ""
        prohibited = ""
    else:
        matched = ""
        missing = ",".join(required)
        prohibited = prohibited_ids_csv
    return {
        "offer_id": offer_id,
        "request_id": request_id,
        "decision": decision,
        "matched_ids_csv": matched,
        "missing_ids_csv": missing,
        "prohibited_ids_csv": prohibited,
    }


def clearable_result(pairs, reason="The bounded compatibility graph is complete."):
    return {"verdict": "CLEARABLE", "pairs": pairs, "reason": reason}


def unverifiable_result(reason="The semantic evidence could not be resolved consistently."):
    return {"verdict": "UNVERIFIABLE", "pairs": [], "reason": reason}
