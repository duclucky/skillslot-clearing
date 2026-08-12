from __future__ import annotations


EMPTY = {
    "status": "UNKNOWN",
    "result": "UNKNOWN",
    "errorCode": None,
    "returnData": None,
}


def _execution_payload(receipt: dict) -> dict:
    direct = receipt.get("execution_result")
    if isinstance(direct, dict):
        return direct
    consensus = receipt.get("consensus_data")
    if isinstance(consensus, dict):
        leaders = consensus.get("leader_receipt")
        if isinstance(leaders, list) and leaders and isinstance(leaders[0], dict):
            value = leaders[0].get("execution_result")
            if isinstance(value, dict):
                return value
            if isinstance(value, str):
                return {"status": value, "result": value}
    return {}


def safe_execution_projection(receipt) -> dict:
    if not isinstance(receipt, dict):
        return dict(EMPTY)

    execution = _execution_payload(receipt)
    status = execution.get("status") or receipt.get("statusName") or receipt.get("status")
    result = (
        execution.get("result")
        or execution.get("name")
        or receipt.get("txExecutionResultName")
        or receipt.get("executionResultName")
    )
    error_code = execution.get("error_code") or execution.get("errorCode") or receipt.get("errorCode")
    return_data = (
        execution.get("return_data")
        if "return_data" in execution
        else execution.get("returnData", receipt.get("returnData"))
    )
    return {
        "status": status or "UNKNOWN",
        "result": result or "UNKNOWN",
        "errorCode": error_code,
        "returnData": return_data,
    }
