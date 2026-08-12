from scripts.deployment_receipts import safe_execution_projection


def test_raw_studio_leader_receipt_projects_only_safe_execution_fields():
    receipt = {
        "status": "FINALIZED",
        "consensus_data": {
            "leader_receipt": [
                {
                    "execution_result": {
                        "status": "SUCCESS",
                        "result": "FINISHED_WITH_RETURN",
                        "return_data": "0x1234",
                        "node_config": {"private": "never expose"},
                    },
                    "stdout": "never expose",
                }
            ]
        },
        "trace": {"private": "never expose"},
    }

    assert safe_execution_projection(receipt) == {
        "status": "SUCCESS",
        "result": "FINISHED_WITH_RETURN",
        "errorCode": None,
        "returnData": "0x1234",
    }


def test_normalized_sdk_success_shape_is_supported():
    receipt = {
        "statusName": "FINALIZED",
        "txExecutionResultName": "FINISHED_WITH_RETURN",
        "returnData": {"round_id": "round-alpha"},
        "node_config": {"private": "never expose"},
    }

    assert safe_execution_projection(receipt) == {
        "status": "FINALIZED",
        "result": "FINISHED_WITH_RETURN",
        "errorCode": None,
        "returnData": {"round_id": "round-alpha"},
    }


def test_explicit_error_shape_preserves_code_without_raw_payload():
    receipt = {
        "status": "FINALIZED",
        "execution_result": {
            "status": "ERROR",
            "error_code": "USER_ERROR",
            "result": "FINISHED_WITH_ERROR",
            "stderr": "private validator details",
        },
    }

    assert safe_execution_projection(receipt) == {
        "status": "ERROR",
        "result": "FINISHED_WITH_ERROR",
        "errorCode": "USER_ERROR",
        "returnData": None,
    }


def test_finalized_without_execution_result_stays_explicitly_unknown():
    assert safe_execution_projection({"status": "FINALIZED"}) == {
        "status": "FINALIZED",
        "result": "UNKNOWN",
        "errorCode": None,
        "returnData": None,
    }


def test_malformed_or_missing_receipt_never_raises_or_invents_success():
    for value in (None, "bad", [], {"consensus_data": {"leader_receipt": "bad"}}):
        assert safe_execution_projection(value) == {
            "status": "UNKNOWN",
            "result": "UNKNOWN",
            "errorCode": None,
            "returnData": None,
        }
