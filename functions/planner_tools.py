from firebase_functions import https_fn, options
import google.generativeai as genai

# --- SECURITY WARNING: Use Firebase Secret Manager in production for API keys. ---
GEMINI_API_KEY = "AIzaSyCugeQ0xzwciuQcWwIH14YB54EqVXgTX1Q"

@https_fn.on_call(cors=options.CorsOptions(cors_origins="*"))
def enhancePlanWithAI(req: https_fn.CallableRequest):
    """
    A callable function to enhance or generate a plan proposal using Gemini AI.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "AIzaSyCugeQ0xzwciuQcWwIH14YB54EqVXgTX1Q":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="The Gemini API key is not configured on the server."
        )

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    original_text = req.data.get("text")
    if not original_text or not original_text.strip():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="The 'text' parameter cannot be empty."
        )

    try:
        prompt = ""
        # If the description is short, treat it as a prompt to generate a full plan.
        if len(original_text) < 150:
            prompt = f"""
              You are a professional project manager. Based on the following idea, generate a detailed project plan proposal in Markdown format.
              The plan should be comprehensive and well-structured, including sections for:
              - ## 🎯 Objectives
              - ## 🔑 Key Milestones
              - ## 🗓️ Timeline (provide a sample timeline in a list format)
              - ## 🛠️ Resources Needed
              - ## 📈 Success Metrics

              Here is the idea:
              ---
              {original_text}
            """
        else:
            # Otherwise, just enhance the existing text.
            prompt = f"""
              You are an expert editor. Please proofread and reformat the following text to improve its clarity, grammar, and structure.
              - Ensure the output is clean, professional Markdown.
              - Correct any spelling or grammatical errors.
              - Organize the content logically with appropriate headings (like ## or ###) and bulleted lists (using -) if it improves readability.
              - Do not add any new information or change the core meaning of the text.
              - Return only the enhanced text, with no introductory phrases.

              Here is the text to enhance:
              ---
              {original_text}
            """
        
        result = model.generate_content(prompt)
        enhanced_text = result.text
        
        return {"status": "success", "enhancedText": enhanced_text}

    except Exception as e:
        print(f"An unexpected error occurred with Gemini: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"An unexpected server error occurred: {e}"
        )