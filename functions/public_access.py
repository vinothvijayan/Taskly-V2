from firebase_functions import https_fn
from firebase_admin import firestore

@https_fn.on_call()
def getPublicPlanData(req: https_fn.CallableRequest):
    """
    A callable function to securely fetch data for a single plan for public viewing.
    """
    team_id = req.data.get("teamId")
    plan_id = req.data.get("planId")

    if not team_id or not plan_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing required parameters: teamId and planId."
        )

    try:
        db = firestore.client()
        plan_ref = db.collection('teams').document(team_id).collection('plans').document(plan_id)
        plan_doc = plan_ref.get()

        if not plan_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="The requested plan could not be found."
            )
        
        plan_data = plan_doc.to_dict()
        
        # Return only the fields that are safe for public viewing
        return {
            "title": plan_data.get("title"),
            "description": plan_data.get("description"),
            "status": plan_data.get("status"),
            "shortDescription": plan_data.get("shortDescription"),
            "createdAt": plan_data.get("createdAt")
        }

    except Exception as e:
        print(f"Error fetching public plan data for plan {plan_id}: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An unexpected error occurred while fetching the plan."
        )