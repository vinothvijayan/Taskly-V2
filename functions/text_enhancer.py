# functions/text_enhancer.py
from firebase_functions import https_fn
import google.generativeai as genai

# --- SECURITY WARNING: Use Firebase Secret Manager in production ---
# Re-using the existing hardcoded key for consistency with the project setup.
GEMINI_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

@https_fn.on_call()
def enhance_text_with_gemini(req: https_fn.CallableRequest):
    """
    A callable function that takes text and uses Gemini to proofread,
    format, and enhance it for clarity and professionalism.
    """
    text_to_enhance = req.data.get("text")
    if not text_to_enhance:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Missing 'text' parameter.")

    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
         raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION, message="Gemini API key is not configured on the server.")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("models/gemini-1.5-flash")

    prompt = """
    You are an expert editor. Please proofread and reformat the following text to improve its clarity, grammar, and structure.
    - Ensure the output is clean, professional Markdown.
    - Correct any spelling or grammatical errors.
    - Organize the content logically with appropriate headings (like ## or ###) and bulleted lists (using -) if it improves readability.
    - Do not add any new information or change the core meaning of the text.
    - Return only the enhanced text, with no introductory phrases like "Here is the enhanced text:".

    Here is the text to enhance:
    ---
    """

    try:
        response = model.generate_content(prompt + text_to_enhance)
        return {"enhancedText": response.text}
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An error occurred while enhancing the text.")