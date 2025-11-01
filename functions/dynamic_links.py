from firebase_functions import https_fn, options
from firebase_admin import firestore, initialize_app, _apps
import os

if not _apps:
    initialize_app()

# The path to the index.html file in the deployed hosting environment
INDEX_HTML_PATH = os.path.join(os.path.dirname(__file__), '..', 'dist', 'index.html')

@https_fn.on_request()
def servePublicPlan(req: https_fn.Request) -> https_fn.Response:
    """
    Intercepts requests for shared plans, injects dynamic meta tags for social previews,
    and serves the main index.html to load the SPA.
    """
    try:
        # Extract teamId and planId from the request path
        path_parts = req.path.strip('/').split('/')
        if len(path_parts) < 4 or path_parts[0] != 'share' or path_parts[1] != 'plan':
            return serve_default_index()

        team_id = path_parts[2]
        plan_id = path_parts[3]

        db = firestore.client()
        plan_ref = db.collection('teams').document(team_id).collection('plans').document(plan_id)
        plan_doc = plan_ref.get()

        if not plan_doc.exists:
            return serve_default_index()

        plan_data = plan_doc.to_dict()
        title = plan_data.get("title", "View this Team Plan on Taskly")
        description = plan_data.get("shortDescription", "A team plan has been shared with you. Click to view the details and collaborate.")

        with open(INDEX_HTML_PATH, 'r') as f:
            html_content = f.read()

        # Create the new meta tags block
        new_meta_tags = f"""
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
        """

        # Replace the placeholder block in the HTML
        start_marker = "<!-- DYNAMIC_OG_TAGS_START -->"
        end_marker = "<!-- DYNAMIC_OG_TAGS_END -->"
        
        start_index = html_content.find(start_marker)
        end_index = html_content.find(end_marker)

        if start_index != -1 and end_index != -1:
            pre_content = html_content[:start_index + len(start_marker)]
            post_content = html_content[end_index:]
            html_content = pre_content + new_meta_tags + post_content

        return https_fn.Response(html_content, headers={'Content-Type': 'text/html'})

    except Exception as e:
        print(f"Error serving dynamic plan page: {e}")
        return serve_default_index()

def serve_default_index():
    """Reads and serves the default index.html file."""
    try:
        with open(INDEX_HTML_PATH, 'r') as f:
            html_content = f.read()
        return https_fn.Response(html_content, headers={'Content-Type': 'text/html'})
    except FileNotFoundError:
        print(f"FATAL: index.html not found at {INDEX_HTML_PATH}")
        return https_fn.Response("Application not found.", status=404)